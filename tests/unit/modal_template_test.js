const fs = require("fs");
const path = require("path");
const assert = require("assert");

const sourcePath = path.join(__dirname, "..", "..", "links-guard.js");
const source = fs.readFileSync(sourcePath, "utf8");

const defaultTemplateMatch = source.match(/const DEFAULT_MODAL_TEMPLATE = `([\s\S]*?)`;/);
if (!defaultTemplateMatch) {
  throw new Error("DEFAULT_MODAL_TEMPLATE non trovato in links-guard.js");
}
const ensureStart = source.indexOf("const ensureModalTemplateElement = () => {");
if (ensureStart === -1) {
  throw new Error("Funzione ensureModalTemplateElement non trovata");
}
const startBrace = source.indexOf("{", ensureStart);
let depth = 0;
let endIndex = -1;
for (let i = startBrace; i < source.length; i += 1) {
  const char = source[i];
  if (char === "{") depth += 1;
  else if (char === "}") {
    depth -= 1;
    if (depth === 0) {
      endIndex = i;
      break;
    }
  }
}
if (endIndex === -1) {
  throw new Error("Impossibile determinare la chiusura della funzione ensureModalTemplateElement");
}
const ensureSource = `${source.slice(ensureStart, endIndex + 1)};`;
const templateIdMatch = source.match(/const MODAL_TEMPLATE_ID = "([^"]+)";/);
if (!templateIdMatch) {
  throw new Error("Costante MODAL_TEMPLATE_ID non trovata");
}

const DEFAULT_MODAL_TEMPLATE = defaultTemplateMatch[1];
const ensureModalTemplateElement = new Function(
  "document",
  "guardNamespace",
  "DEFAULT_MODAL_TEMPLATE",
  "MODAL_TEMPLATE_ID",
  `${ensureSource}; return ensureModalTemplateElement;`
);

const createDocument = (options = {}) => {
  const state = {
    storedTemplate: options.storedTemplate || null,
    created: []
  };
  return {
    state,
    getElementById(id) {
      if (!state.storedTemplate) return null;
      return state.storedTemplate.id === id ? state.storedTemplate : null;
    },
    createElement(tag) {
      const template = {
        tagName: tag.toUpperCase(),
        id: "",
        innerHTML: "",
        content: {}
      };
      state.created.push(template);
      return template;
    }
  };
};

// Scenario 1: fallback automatico
{
  const document = createDocument();
  const guardNamespace = {};
  const ensure = ensureModalTemplateElement(
    document,
    guardNamespace,
    DEFAULT_MODAL_TEMPLATE,
    templateIdMatch[1]
  );
  const template = ensure();
  assert.ok(template, "Il template di fallback deve esistere");
  assert.strictEqual(template.id, templateIdMatch[1]);
  assert.strictEqual(guardNamespace.templates.modal, template);
  assert.ok(
    template.innerHTML.includes('data-slg-element="open"'),
    "Il template di fallback deve contenere il collegamento open"
  );
}

// Scenario 2: template DOM esistente
{
  const domTemplate = { id: templateIdMatch[1], innerHTML: "<div>personalizzato</div>" };
  const document = createDocument({ storedTemplate: domTemplate });
  const guardNamespace = {};
  const ensure = ensureModalTemplateElement(
    document,
    guardNamespace,
    DEFAULT_MODAL_TEMPLATE,
    templateIdMatch[1]
  );
  const template = ensure();
  assert.strictEqual(template, domTemplate, "Deve restituire il template DOM");
  assert.strictEqual(guardNamespace.templates.modal, domTemplate);
}

// Scenario 3: template definito nel namespace come stringa
{
  const document = createDocument();
  const guardNamespace = {
    templates: {
      modal: "<div data-slg-root>Inline</div>"
    }
  };
  const ensure = ensureModalTemplateElement(
    document,
    guardNamespace,
    DEFAULT_MODAL_TEMPLATE,
    templateIdMatch[1]
  );
  const template = ensure();
  assert.strictEqual(template.id, templateIdMatch[1]);
  assert.strictEqual(
    guardNamespace.templates.modal,
    template,
    "La stringa deve essere convertita in template riutilizzabile"
  );
  assert.ok(
    template.innerHTML.includes("Inline"),
    "Il contenuto personalizzato deve essere mantenuto"
  );
}

console.log("modal_template_test: tutti i casi superati");
