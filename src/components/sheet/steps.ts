import { type Ref, ref } from 'vue'

export type Direction = 'fwd' | 'back'

/**
 * Where a sheet is in its run of screens, and which way it last moved (so the
 * shell knows which side to slide the next screen in from). Opens on the first step.
 */
export function useSteps<S extends string>(steps: readonly [S, ...S[]]) {
  const step = ref(steps[0]) as Ref<S>
  const direction = ref<Direction>('fwd')

  function go(next: S) {
    direction.value = 'fwd'
    step.value = next
  }

  function back() {
    direction.value = 'back'
    step.value = steps[Math.max(0, steps.indexOf(step.value) - 1)] ?? steps[0]
  }

  return { step, direction, go, back }
}
