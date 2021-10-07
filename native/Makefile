ifeq ($(OS),Windows_NT)
  TARGET := exteditor.exe
else
	# linux or macos
  TARGET := exteditor
endif

SRCS := main.go

.PHONY: all
all: build

.PHONY: pkg
pkg: linux macos windows

.PHONY: clean
clean:
	rm -rf $(TARGET)  output

.PHONY: rebuild
rebuild: clean
	$(MAKE) all

.PHONY: build
build:
	go build -o $(TARGET)

.PHONY: dbgbuild
dbgbuild:
	go build -race -o $(TARGET)

.PHONY: mkoutput
mkoutput:
	mkdir -p output/linux
	mkdir -p output/macos
	mkdir -p output/windows

.PHONY: mkoutput | linux
linux: $(SRCS)
	GOOS=linux GOARCH=amd64 go build -o output/linux/$(TARGET)

.PHONY: mkoutput | macos
macos: $(SRCS)
	GOOS=darwin GOARCH=amd64 go build -o output/macos/$(TARGET)

.PHONY: mkoutput | windows
windows: $(SRCS)
	GOOS=windows GOARCH=amd64 go build -o output/windows/$(TARGET)

debug:
	go build -race -o $(TARGET)

