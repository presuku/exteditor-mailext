# External Editor for MailExtension

External Editor for [MailExtension](https://developer.thunderbird.net/add-ons/mailextensions)
(exteditor-mailext) is add-on for a Thunderbird 78.x (or later) that allows you
to compose e-mail using an external editor.  
This add-on is based on [Textern](https://github.com/jlebon/textern) (Firefox add-on)
and MailExtension verion of [External Editor](https://github.com/exteditor/exteditor).

The add-on is divided into two parts:

- The MailExtension add-on, which handles UI (key-mapping, add-on button and
  refresh text area in compose window) on Thunderbird and connect to the native
  application to communicate e-mail data.  
  Currently, you need to create the xpi package by yourself and install it in Thunderbird.
- The native application, which handles writing e-mail data from MailExtension
  add-on to a file at first time, text editor launching with the file,
  monitoring the file and sending data of the file to MailExtension add-on.  
  You also need to install the native application to your system

The native application currently only supports Linux with Python 3.5 or later.  
Patches to add support for other platforms are welcome!

## Installation

To clone the repository:

```sh
git clone https://github.com/presuku/exteditor-mailext
cd exteditor-mailext
```

To make the xpi file, run:

```sh
make xpi
```

To install the native app, run:

```sh
sudo make native-install
```

To uninstall it, run:

```sh
sudo make native-uninstall
```

On distros which do not use `/usr/lib64` (such as Debian/Ubuntu), you'll want
to override `LIBDIR`:

```sh
sudo make native-install LIBDIR=/usr/lib
```

If you do not have root privileges or wish to only install the native app for
the current user, run:

```sh
make native-install USER=1
```

## Usage

Once both the MailExtension and the native application are installed, you can
press Ctrl+E (default) or click add-on button on a compose window to open an
external editor.  
The textarea in the compose window will flash yellow after the file is saved by
external editor.

### Headers Edition

If you choose to edit the headers on add-on's preferences, the headers can be
edited in the external editor, given as a comma separated list in a paragraph
before the message content.

Supported headers are: `Subject, To, Cc, Bcc, Reply-To, Newsgroup, Followup-To.`

```eml
Subject:  Here is the subject
To:       adressTo1, adressTo2
Cc:       adressCc1
Bcc:
Reply-To:
-=-=-=-=-=-=-=-=-=# Don't remove this line #=-=-=-=-=-=-=-=-=-
... the mail content begins here ...
```

But you can then modify it, use multiple lines, and add as many headers type as
you want.

Example:

```eml
To: adresseTo1, adresseTo
adresseTo3
adresseTo4, adresseTo5
Cc: adresseCc1
adresseCc2, adresseCc3
To:adresseTo6
To:adresseTo7
...
-=-=-=-=-=-=-=-=-=# Don't remove this line #=-=-=-=-=-=-=-=-=-
```

(many part of this section from original external editor)

## Setting

You can change editor, key mapping, document extension and editing e-mail
header as well as the configured editor in the add-on preferences.

### Path and arguments of external editor

The default external editor is set to gedit (from Textern but I don't use it).  
Set the path to the external editor and additional parameters to be JSON-like
as shown below.

```sh
["gedit", "+%l:%c"]
```

It means,

```sh
["myeditor", "--custom-arg"]
```

will launch `myeditor --custom-arg /path/to/file.txt`.  
You may use `%s` as a variable for the file path if don't want it to be the
last argument.

### Key mapping (Shortcut key)

The default key mapping is set to `Ctrl-E` (from original external editor).  
Also you can use other [shortcut values](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands#shortcut_values).

Note that for now, I recommend to set key-mapping on add-on's preferences
instead of "Manage Extension Shortcuts".  
Because `Ctrl+E` on compose window isn't used by default but you can't set it
on "Manage Extension Shortcuts".

### Document extension

The default document extension opend by extenal editor is set to `eml` (from
original external editor).

### Edit headers

You can choose to edit the header and what header you want to edit.

## Setting examples

### Terminal editors

If you would like to use a terminal editor such as vim or
emacs, you will need to modify the configuration such that
Textern starts a terminal emulator which runs the text
editor.

For example, for `vim` this could look like

```json
["xterm", "-e", "vim", "+call cursor(%l,%c)"]
```

Here, `xterm` is the terminal emulator, `-e` instructs it to start a program,
which is `nvim` (the editor we're actually interested in) with the given
parameters.  
This works similarly with `konsole` or `gnome-terminal` instead of `xterm`.

For example, starting `vim` with `gnome-terminal`:

```json
["gnome-terminal", "--wait", "--", "vim", "+call cursor(%l,%c)"]
```

Note that by default the `gnome-terminal` process won't wait for the spawned
process to finish before exiting so you'll need to make sure you add the
`--wait` flag.

Another example for `xfce4-terminal`

```json
["xfce4-terminal", "--disable-server", "-x", "vim", "+call cursor(%l,%c)"]
```

Note that behaviour of `--disable-sever` is similar to the `--wait` flag of
`gnome-terminal`, but it is documented in the help text as "Do not register
with D-BUS session message bus".

### GUI editors

Non-terminal-based editors can also suffer from the same waiting problem
described above. For example, gedit does not fork and thus can be used directly:

```json
["gedit"]
```

On the other hand, `gvim` by default will fork and detach.  
One must thus make sure to pass the `-f` switch for it to stay in the foreground:

```json
["gvim", "-f"]
```

#### Flatpak

Flatpak-packaged editors should work fine, as long as the application has
access to the `XDG_RUNTIME_DIR` directory.  
For example, to use the GNOME gedit flatpak, use:

```json
["flatpak", "run", "--filesystem=xdg-run/exteditor.py", "org.gnome.gedit"]
```

### Caret position

If your editor supports it, you can also use `%l` and `%c` to pass the line and
column number of the caret position.
(The capitalized versions `%L` and `%C` also exist which are smaller by one for
text editors that count from zero).

For example, passing this information to `gvim` (or `vim`):

- Mostly when using single-byte characters

  ```json
  ["gvim", "-f", "+call cursor(%l,%c)"]
  ```

- Support multi-byte characters
  - patch 8.2.2324 or later

    ```json
    ["gvim", "-f", "+call setcursorcharpos(%l, %c)"]
    ```

  - vim 8.0 (avaliable lambda function) to before patch 8.2.2324

    ```json
    ["gvim", "-f", "+call cursor(%l, {c -> c != -1 ? c : len(getline(%l))}(byteidx(getline(%l),%c)))"]
    ```

  - before vim 8.0

    ```json
    ["gvim", "-f", "+let b:c = byteidx(getline(%l),%c) | call cursor(%l, b:c != -1 ? b:c : len(getline(%l)))"]
    ```

    Note that `b:c` is buffer-local variable in this example so `b:c` leaks to
    buffer-local scope.

Example for emacs:

```json
["emacs", "%s", "--eval", "(progn (goto-line %l) (move-to-column (1- %c)))"]
```

## FAQ

- Why is something different from the original External Editor ?  
  I have used a part of it, so I don't know all original feature (especially
  editing in html mode).  
  If you know someting about original External editor, issue report and pull
  requests are welcome.

## Troubleshooting

Some things to try if it doesn't work properly:

- Ensure you are running the latest version of Thunderbird
- Try configuring exteditor to launch using a different shortcut
- Try configuring exteditor to use the following as the external editor:
  `["sh", "-c", "echo foobar > $0"]` (that should just echo foobar into the
  textarea box)
- Check the browser console for errors (Ctrl+Shift+I)
- Check the extension's console for errors (Go to `about:debugging`, find
  exteditor-mailext in the list of extensions, and click Inspect)
- Try re-installing but for your local user (`make native-install USER=1`
  instead of `sudo make native-install`)
- Check if exteditor is running in the background (`ps aux | grep exteditor`)

## Special Thanks

### Textern

[https://github.com/jlebon/textern](https://github.com/jlebon/textern)

Textern is Firefox add-on but similar feture of this add-on and source code of
this add-on is based on Textern.

### Extenal Editor

[https://github.com/exteditor/exteditor](https://github.com/exteditor/exteditor)

This is the project that inspired this add-on.  
Unfortunately, it is not compatible with MailExtensions and thus cannot be
installed on Thunderbird 78 or later.
