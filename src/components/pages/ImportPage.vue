<script setup lang="ts">
// Import a recipe: copy a prompt for an AI, give it the recipe, paste what comes back. The
// prompt asks for JSON in a plain, documented shape; the paste box says exactly what's wrong
// if something is, and Import opens the new recipe.
import { computed, ref } from 'vue'
import { IMPORT_PROMPT, parseRecipeJson } from '../../lib/recipeImport'
import { importRecipe, type Recipe } from '../../store'
import PageShell from './PageShell.vue'

const emit = defineEmits<{ back: []; open: [recipe: Recipe] }>()

// Copying can fail (an old browser, a page not on https): then the prompt is shown to copy by hand.
const copied = ref(false)
const showPrompt = ref(false)
const promptBox = ref<HTMLTextAreaElement>()
async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(IMPORT_PROMPT)
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    showPrompt.value = true
    requestAnimationFrame(() => {
      promptBox.value?.focus()
      promptBox.value?.select()
    })
  }
}

const pasted = ref('')
const result = computed(() => (pasted.value.trim() ? parseRecipeJson(pasted.value) : null))
const problem = computed(() => result.value?.error ?? '')
const preview = computed(() => {
  const r = result.value?.recipe
  if (!r) return ''
  const n = r.steps.length
  return `${r.name}: ${n} step${n === 1 ? '' : 's'}, ${r.ingredients?.length ?? 0} ingredients${r.serves ? `, serves ${r.serves}` : ''}`
})

function doImport() {
  const r = result.value?.recipe
  if (r) emit('open', importRecipe(r))
}
</script>

<template>
  <PageShell title="Import a recipe" @back="emit('back')">
    <ol class="how">
      <li>
        <p><strong>Copy the prompt</strong> and give it to an AI (ChatGPT, Claude, Gemini…) along with the recipe: pasted text, a link, or a photo of the page.</p>
        <button class="copy" :class="{ done: copied }" @click="copyPrompt">{{ copied ? 'Copied' : 'Copy the prompt' }}</button>
        <button v-if="!showPrompt" class="link" @click="showPrompt = true">Show the prompt instead</button>
        <textarea v-if="showPrompt" ref="promptBox" class="prompt" readonly aria-label="The prompt" :value="IMPORT_PROMPT" rows="8" />
      </li>
      <li>
        <p><strong>Paste its reply here.</strong></p>
        <textarea
          v-model="pasted"
          class="paste"
          rows="7"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          placeholder='{ "name": "Chicken curry", "serves": 4, "ingredients": [ … ], "steps": [ … ] }'
          aria-label="The recipe JSON"
          :aria-invalid="!!problem || undefined"
          :aria-describedby="problem ? 'import-problem' : undefined"
        />
        <p v-if="problem" id="import-problem" class="problem" role="alert">{{ problem }}</p>
        <p v-else-if="preview" class="preview" role="status">{{ preview }}</p>
      </li>
    </ol>
    <button class="go" :disabled="!result?.recipe" @click="doImport">Import</button>
  </PageShell>
</template>

<style scoped>
.how {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0;
  padding-left: 22px;
}

.how li {
  line-height: 1.4;
}

.how li > * {
  display: block;
  margin: 0 0 10px;
}

.how li::marker {
  font-weight: 800;
  color: var(--text-dim);
}

.copy {
  min-height: 52px;
  padding: 0 22px;
  border-radius: 26px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.05rem;
  font-weight: 800;
}

.copy.done {
  background: var(--done);
  color: var(--on-done);
}

.copy:active {
  transform: scale(0.97);
}

.link {
  min-height: 40px;
  padding: 0 4px;
  color: var(--text-dim);
  font-weight: 650;
}

.prompt,
.paste {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font: 15px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: vertical;
}

.paste:focus {
  border-color: var(--accent);
  outline: none;
}

.paste[aria-invalid='true'] {
  border-color: var(--danger);
}

.problem,
.preview {
  margin: 0;
  font-weight: 600;
}

.problem {
  color: var(--danger);
}

.preview {
  color: var(--done);
}

.go {
  min-height: 64px;
  margin-top: 6px;
  border-radius: 32px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 1.3rem;
  font-weight: 800;
}

.go:disabled {
  background: var(--surface-2);
  color: var(--text-dim);
}

.go:not(:disabled):active {
  transform: scale(0.98);
}
</style>
