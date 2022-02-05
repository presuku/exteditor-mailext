package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"unicode"

	"github.com/fsnotify/fsnotify"
)

type myLogStruct struct{}

var (
	enable_log = false
	mylog      = &myLogStruct{}
)

func (l *myLogStruct) Printf(format string, v ...interface{}) {
	if enable_log {
		log.Printf(format, v...)
	}
}
func (l *myLogStruct) Fatalf(format string, v ...interface{}) {
	if enable_log {
		log.Fatalf(format, v...)
	}
}

type Message struct {
	Mtype   string `json:"type,omitempty"`
	Payload struct {
		Id        string `json:"id,omitempty"`
		Text      string `json:"text,omitempty"`
		Caret     int    `json:"caret,omitempty"`
		Subject   string `json:"subject,omitempty"`
		Editor    string `json:"editor,omitempty"`
		Extension string `json:"extension,omitempty"`
		Error     string `json:"error,omitempty"`
	} `json:"payload,omitempty"`
}

type tmpManager struct {
	tmp_dir   string
	tmp_files map[string]string
	errch     chan error
	exec_done chan struct{}
	mu        *sync.RWMutex
}

type EditorArgs struct {
	X map[string]interface{}
}

func max(a, b int) int {
	if a > b {
		return a
	} else {
		return b
	}
}

func min(a, b int) int {
	if a < b {
		return a
	} else {
		return b
	}
}

func offset_to_line_and_column(msg *Message) (int, int) {
	rtext := []rune(msg.Payload.Text)
	offset := max(0, min(len(rtext), msg.Payload.Caret))
	s_rtext := rtext[:offset]
	line := (func(runes []rune, target rune) int {
		var n int = 0
		for _, r := range runes {
			if r == target {
				n++
			}
		}
		return n
	}(s_rtext[:], rune('\n')))

	column := 0
	if line == 0 {
		column = offset
	} else {
		idx := (func(runes []rune, target rune) int {
			for i := range runes {
				if runes[len(runes)-1-i] == target {
					return len(runes) - 1 - i
				}
			}
			return -1
		})(s_rtext[:], rune('\n'))
		column = len(s_rtext[idx+1:])
	}
	return line, column
}

func get_final_editor_args(args []string, absfn string, line, column int) []string {
	final_editor_args := make([]string, len(args), len(args)+1)
	fn_added := false
	replacer := strings.NewReplacer(
		"%s", absfn,
		"%l", strconv.Itoa(line+1),
		"%L", strconv.Itoa(line),
		"%c", strconv.Itoa(column+1),
		"%C", strconv.Itoa(column),
	)
	for i, arg := range args {
		fn_added = strings.Contains(arg, "%s")
		output := replacer.Replace(arg)
		final_editor_args[i] = output
	}
	if !fn_added {
		final_editor_args = append(final_editor_args, absfn)
	}
	return final_editor_args
}

func send_raw_message(raw_msg []byte) {
	l := uint32(len(raw_msg))
	lbuf := make([]byte, 4)

	binary.LittleEndian.PutUint32(lbuf, l)

	os.Stdout.Write(lbuf)
	os.Stdout.Write(raw_msg)
	os.Stdout.Sync()

	// mylog.Printf("raw:%s\n", raw_msg)
	mylog.Printf("send raw:%d\n", l)

	return
}

func send_message(msg *Message) {
	raw_msg, err := json.Marshal(msg)
	if err != nil {
		mylog.Fatalf("internal error: json marshal\n")
		return
	}
	send_raw_message(raw_msg)
	return
}

func send_text_update(id string, text []byte) {
	msg := &Message{}
	msg.Mtype = "text_update"
	msg.Payload.Id = id
	msg.Payload.Text = string(text)
	send_message(msg)
}

func send_death_notice(id string) {
	msg := &Message{}
	msg.Mtype = "death_notice"
	msg.Payload.Id = id
	send_message(msg)
}

func send_error(err error) {
	msg := &Message{}
	msg.Mtype = "error"
	msg.Payload.Error = err.Error()
	send_message(msg)
}

func send_if_error(err *error) {
	if *err != nil {
		send_error(*err)
	}
}

func handle_inotify_event(ctx context.Context, tmp_mgr *tmpManager) error {
	var err error = nil
	defer send_if_error(&err)

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer watcher.Close()

	err = watcher.Add(tmp_mgr.tmp_dir)
	if err != nil {
		return nil
	}

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return errors.New("watcher close")
			}
			if event.Op&fsnotify.Write == fsnotify.Write {
				mylog.Printf("event:%s, file:%s\n", event, event.Name)
				id, text, err := tmp_mgr.get(filepath.Base(event.Name))
				if err != nil {
					return err
				}
				mylog.Printf("len msg:%d\n", len(text))
				send_text_update(id, text)
			}
		case err, ok := <-watcher.Errors:
			mylog.Printf("watcher error:%s\n", err)
			if !ok {
				return errors.New("watcher error close")
			}
			return err
		case <-tmp_mgr.exec_done:
			break
		case <-ctx.Done():
			return nil
		}
	}
}

func handle_message_new_text(ctx context.Context, tmp_mgr *tmpManager, msg *Message) error {
	innerCtx, cancel := context.WithCancel(ctx)
	absfn, err := tmp_mgr.new(msg)
	defer tmp_mgr.delete(msg, absfn, &err)
	defer send_if_error(&err)
	defer cancel()
	if err != nil {
		return err
	}

	editor_args := []string{}
	if err := json.Unmarshal([]byte(msg.Payload.Editor), &editor_args); err != nil {
		return err
	}

	line, column := offset_to_line_and_column(msg)
	editor_args = get_final_editor_args(editor_args, absfn, line, column)

	mylog.Printf("editor_args: %s\n", editor_args)

	go func() {
		tmp_mgr.errch <- handle_inotify_event(innerCtx, tmp_mgr)
	}()

	err = exec.Command(editor_args[0], editor_args[1:]...).Run()
	if err != nil {
		return err
	}

	mylog.Printf("exec command done: %v\n", err)

	tmp_mgr.exec_done <- struct{}{}

	return nil
}

func handle_message(ctx context.Context, tmp_mgr *tmpManager, msg *Message) {
	switch msg.Mtype {
	case "new_text":
		go func() {
			tmp_mgr.errch <- handle_message_new_text(ctx, tmp_mgr, msg)
		}()
	}
}

func handle_stdin(ctx context.Context, tmp_mgr *tmpManager) error {
	rawLenByte := make([]byte, 4)
	for {
		_, err := io.ReadFull(os.Stdin, rawLenByte)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		msgLen := binary.LittleEndian.Uint32(rawLenByte)
		rawMsg := make([]byte, msgLen)
		_, err = io.ReadFull(os.Stdin, rawMsg)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		// mylog.Printf("len:%d, msg:%s\n", msgLen, rawMsg)
		mylog.Printf("len:%d\n", msgLen)

		msg := Message{}
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			return err
		}
		rawMsg = nil
		handle_message(ctx, tmp_mgr, &msg)
	}
}

func (tm tmpManager) new(msg *Message) (string, error) {
	filename := func(s, m, e string) string {
		bstr := make([]byte, 0, len(s)+len(m)+len(e))
		r_underscore := rune('_')
		for _, r := range s {
			if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
				r = r_underscore
			}
			bstr = append(bstr, string(r)...)
		}
		bstr = append(bstr, m...)
		bstr = append(bstr, e...)
		return string(bstr)
	}(msg.Payload.Subject, "-*.", msg.Payload.Extension)

	f, err := os.CreateTemp(tm.tmp_dir, filename)
	if err != nil {
		return "", err
	}
	absfn := f.Name()

	if _, err := f.Write([]byte(msg.Payload.Text)); err != nil {
		return "", err
	}
	f.Close()

	relfn := filepath.Base(absfn)
	tm.setIdToTmpFiles(relfn, msg.Payload.Id)

	return absfn, nil
}

func (tm tmpManager) get(relfn string) (string, []byte, error) {
	id, ok := tm.getIdFromTmpFiles(relfn)
	if !ok {
		return "", nil, errors.New("relfn dose not exsit in tmp_files")
	}

	text, err := os.ReadFile(filepath.Join(tm.tmp_dir, relfn))
	if err != nil {
		return "", nil, err
	}

	return id, text, nil
}

func (tm tmpManager) setIdToTmpFiles(relfn string, id string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.tmp_files[relfn] = id
}

func (tm tmpManager) getIdFromTmpFiles(relfn string) (string, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	v, ok := tm.tmp_files[relfn]
	return v, ok
}

func (tm tmpManager) existsIdInTmpFiles(relfn string) bool {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	v, ok := tm.tmp_files[relfn]
	return (v != "") && ok
}

func (tm tmpManager) deleteIdIdTmpFiles(relfn string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.tmp_files[relfn] = ""
}

func (tm tmpManager) delete(msg *Message, absfn string, err *error) {
	relfn := filepath.Base(absfn)
	tm.deleteIdIdTmpFiles(relfn)
	os.Remove(absfn)
	send_death_notice(msg.Payload.Id)
}

func NewTmpManager() (*tmpManager, error) {
	td := ""
	if runtime.GOOS == "windows" {
		// path is C:\Users\%USERNAME%\AppData\Local\Temp\exteditor
		t := os.TempDir()
		td = filepath.Join(t, "exteditor")
	} else {
		t := os.Getenv("XDG_RUNTIME_DIR")
		if t != "" {
			// path is /run/user/[uid]/exteditor
			td = filepath.Join(t, "exteditor")
		} else {
			t := os.TempDir()
			//  path is /tmp/$USER/exteditor
			if filepath.Base(t) == "tmp" {
				td = filepath.Join(os.TempDir(), os.Getenv("USER"), "exteditor")
			} else {
				td = filepath.Join(os.TempDir(), "exteditor")
			}
		}
	}

	err := os.MkdirAll(td, 0700)
	if err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp(td, "*")
	if err != nil {
		return nil, err
	}

	ret := &tmpManager{tmp_dir: dir, tmp_files: map[string]string{}}
	ret.mu = &sync.RWMutex{}
	ret.errch = make(chan error, 3)
	ret.exec_done = make(chan struct{})
	return ret, nil
}

func main() {
	if enable_log {
		log.SetPrefix("[Log] ")
		log.SetOutput(os.Stderr)
	}

	tmp_mgr, err := NewTmpManager()
	if err != nil {
		mylog.Fatalf("something error occurs when create temporary directory:%s", err.Error())
	}
	defer os.RemoveAll(tmp_mgr.tmp_dir)

	ctx := context.Background()

	go func() {
		tmp_mgr.errch <- handle_stdin(ctx, tmp_mgr)
	}()

	results := func() []error {
		var results []error
		for i := 0; i < 3; i++ {
			select {
			case result := <-tmp_mgr.errch:
				results = append(results, result)
			}
		}
		return results
	}()

	exit_code := 0
	for _, err := range results {
		if err != nil {
			exit_code = 1
		}
	}
	mylog.Printf("results:%+v\n", results)
	os.Exit(exit_code)
}
