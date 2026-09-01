<script setup lang="ts">
/**
 * The appearance a member reads in. Nothing is saved to the account: it belongs to the device,
 * where the ambient light is.
 */
import { Moon, Sun, SunMoon } from '@lucide/vue'
import type { ThemeChoice } from '@/composables/useTheme'
import { useTheme } from '@/composables/useTheme'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Field, FieldDescription } from '@/components/ui/field'

const { choice } = useTheme()

/** Sun, both, moon — the three read as a set, and none of them carries the meaning alone. */
const CHOICES: ReadonlyArray<{
  value: ThemeChoice
  label: string
  icon: typeof Sun
}> = [
  { value: 'auto', label: 'Wie das Gerät', icon: SunMoon },
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
]
</script>

<template>
  <Field>
    <RadioGroup v-model="choice" aria-label="Erscheinungsbild" class="gap-0">
      <Label
        v-for="option in CHOICES"
        :key="option.value"
        class="flex min-h-11 cursor-pointer items-center gap-3 text-body font-normal md:min-h-9"
      >
        <RadioGroupItem :value="option.value" />
        <span class="flex items-center gap-2">
          <component :is="option.icon" :size="14" :stroke-width="1.5" aria-hidden="true" />
          {{ option.label }}
        </span>
      </Label>
    </RadioGroup>
    <FieldDescription>
      Gilt nur auf diesem Gerät und bleibt bis zum nächsten Besuch erhalten.
    </FieldDescription>
  </Field>
</template>
