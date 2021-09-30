ifneq ($(USER),1)
	PREFIX ?= /usr/local
	MOZILLA_PREFIX ?= /usr
	LIBDIR ?= /usr/lib64
	MOZILLA_NATIVE ?= $(LIBDIR)/mozilla/native-messaging-hosts
else
	PREFIX ?= $(HOME)/.local
	MOZILLA_NATIVE ?= $(HOME)/.mozilla/native-messaging-hosts
endif

LIBEXEC ?= $(PREFIX)/libexec

.PHONY: all
all:
	@echo "No build step. Available targets:"
	@echo "native-install          install native app"
	@echo "native-uninstall        uninstall native app"
	@echo "xpi                     create XPI webex archive"
	@echo
	@echo "Set USER=1 to target user directories instead."

# make phony and don't depend on .in file in case $USER changes
.PHONY: native/exteditor.json.in
native/exteditor.json:
	sed -e 's|@@NATIVE_PATH@@|$(LIBEXEC)/exteditor/exteditor.py|' $@.in > $@

.PHONY: native-install
native-install: native/exteditor.json
	@if ! test -f native/inotify_simple/.git; then echo "Missing inotify_simple submodule! Try 'git submodule update --init'."; false; fi
	mkdir -p $(DESTDIR)$(MOZILLA_NATIVE)
	cp -f native/exteditor.json $(DESTDIR)$(MOZILLA_NATIVE)
	mkdir -p $(DESTDIR)$(LIBEXEC)/exteditor
	cp -rf native/exteditor.py native/inotify_simple $(DESTDIR)$(LIBEXEC)/exteditor

.PHONY: native-uninstall
native-uninstall:
	rm -f $(DESTDIR)$(MOZILLA_NATIVE)/exteditor.json
	rm -rf $(DESTDIR)$(LIBEXEC)/exteditor

.PHONY: xpi
xpi:
	@rm -f exteditor.xpi && cd webex && zip -r -FS ../exteditor.xpi *
