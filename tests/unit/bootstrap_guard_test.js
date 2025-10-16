const assert = require('assert');
const fs = require('fs');
const path = require('path');

const bootstrapFactory = require(path.resolve(__dirname, '../../links-guard.bootstrap.js'));

const createAnchor = (href) => {
  const attrs = { href };
  return {
    tagName: 'A',
    attributes: attrs,
    dataset: {},
    href,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = value;
      if (name === 'href') {
        this.href = value;
      }
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    },
    closest(selector) {
      return selector === 'a[href]' ? this : null;
    }
  };
};

const createClickEvent = (anchor) => ({
  target: anchor,
  defaultPrevented: false,
  preventDefaultCalled: false,
  stopPropagationCalled: false,
  stopImmediatePropagationCalled: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  button: 0,
  preventDefault() {
    this.preventDefaultCalled = true;
    this.defaultPrevented = true;
  },
  stopPropagation() {
    this.stopPropagationCalled = true;
  },
  stopImmediatePropagation() {
    this.stopImmediatePropagationCalled = true;
  }
});

const createEnvironment = ({ anchors: initialAnchors = [], config = {}, windowConfig = {} } = {}) => {
  const anchors = [];
  initialAnchors.forEach((anchor) => anchors.push(anchor));
  const listeners = {};
  const documentMock = {
    baseURI: 'https://site.test/page',
    getElementsByTagName(tag) {
      return tag.toLowerCase() === 'a' ? anchors : [];
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type, handler) {
      if (listeners[type] === handler) {
        delete listeners[type];
      }
    },
    head: { appendChild() {} }
  };

  const windowMock = {
    location: { href: 'https://site.test/page', hostname: 'site.test' },
    confirm: windowConfig.confirm || (() => true),
    open: windowConfig.open || (() => {}),
    SafeExternalLinksGuardBootstrap: { config: config }
  };

  const bootstrap = bootstrapFactory(windowMock, documentMock);

  return { anchors, listeners, bootstrap, window: windowMock, document: documentMock };
};

(() => {
  const anchor = createAnchor('https://external.test/path');
  const env = createEnvironment({ anchors: [anchor] });
  assert.strictEqual(anchor.getAttribute('target'), '_blank', 'Bootstrap should force target="_blank"');
  const relTokens = (anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
  assert(relTokens.includes('noopener'), 'rel should include noopener');
  assert(relTokens.includes('noreferrer'), 'rel should include noreferrer');
  assert(relTokens.includes('nofollow'), 'rel should include nofollow');
})();

(() => {
  const anchor = createAnchor('https://external.test/');
  let confirmCalls = 0;
  let opened = null;
  const env = createEnvironment({
    anchors: [anchor],
    windowConfig: {
      confirm: () => {
        confirmCalls += 1;
        return true;
      },
      open: (url, target) => {
        opened = { url, target };
        return { focus() {} };
      }
    }
  });
  const clickHandler = env.listeners.click;
  assert.ok(clickHandler, 'Bootstrap should register click listener');
  const event = createClickEvent(anchor);
  clickHandler(event);
  assert.strictEqual(confirmCalls, 1, 'Fallback should open confirm dialog');
  assert.strictEqual(event.preventDefaultCalled, true, 'Event should be prevented');
  assert.strictEqual(opened.url, 'https://external.test/');
  assert.strictEqual(opened.target, '_blank');
})();

(() => {
  const anchor = createAnchor('https://trusted.test/page');
  let confirmCalled = false;
  const env = createEnvironment({
    anchors: [anchor],
    config: { allowlist: ['trusted.test'] },
    windowConfig: {
      confirm: () => {
        confirmCalled = true;
        return false;
      }
    }
  });
  const clickHandler = env.listeners.click;
  const event = createClickEvent(anchor);
  clickHandler(event);
  assert.strictEqual(confirmCalled, false, 'Allowlisted domains should not trigger the confirm');
  assert.strictEqual(event.preventDefaultCalled, false, 'Allowlisted click should not be blocked');
})();

(() => {
  const anchor = createAnchor('https://external.test/page');
  const env = createEnvironment({ anchors: [anchor] });
  const handled = [];
  env.bootstrap.forwardTo((evt, forwardedAnchor) => {
    handled.push({ evt, forwardedAnchor });
    evt.preventDefault();
  });
  const clickHandler = env.listeners.click;
  const event = createClickEvent(anchor);
  clickHandler(event);
  assert.strictEqual(handled.length, 1, 'Forward handler should intercept the click');
  assert.strictEqual(handled[0].forwardedAnchor, anchor, 'Forward handler receives the anchor');
  assert.strictEqual(event.preventDefaultCalled, true, 'Forward handler can prevent default navigation');
  env.bootstrap.forwardTo(null);
  env.bootstrap.release();
  assert.strictEqual(env.listeners.click, undefined, 'Release should remove the bootstrap listener');
})();

(() => {
  const inlineContent = fs.readFileSync(
    path.resolve(__dirname, '../../resources/bootstrap-inline.min.js'),
    'utf8'
  );
  assert.ok(
    inlineContent.length < 2048,
    'Inline bootstrap must remain under 2 KB'
  );
  assert.ok(
    /removeEventListener\('click',R,true\)/.test(inlineContent),
    'Inline bootstrap release must remove the click listener'
  );
})();
