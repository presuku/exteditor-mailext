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
	@echo "xpi                     create XPI mailext archive"
	@echo
	@echo "Set USER=1 to target user directories instead."

.PHONY: clean
clean:
	rm exteditor.xpi

# make phony and don't depend on .in file in case $USER changes
native/exteditor.json: native/exteditor.json.in
	sed -e 's|@@NATIVE_PATH@@|$(LIBEXEC)/exteditor/exteditor|' $@.in > $@

.PHONY: native-build
native-build:
	$(MAKE) -C native

.PHONY: native-install
native-install: native/exteditor.json native-build
	mkdir -p $(DESTDIR)$(MOZILLA_NATIVE)
	cp -f native/exteditor.json $(DESTDIR)$(MOZILLA_NATIVE)
	mkdir -p $(DESTDIR)$(LIBEXEC)/exteditor
	cp -f native/exteditor $(DESTDIR)$(LIBEXEC)/exteditor

.PHONY: native-uninstall
native-uninstall:
	rm -f $(DESTDIR)$(MOZILLA_NATIVE)/exteditor.json
	rm -rf $(DESTDIR)$(LIBEXEC)/exteditor

.PHONY: xpi
xpi:
	@rm -f exteditor.xpi && cd mailext && zip -r -FS ../exteditor.xpi *
