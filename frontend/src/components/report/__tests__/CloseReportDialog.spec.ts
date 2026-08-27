import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CloseReportDialog from '@/components/report/CloseReportDialog.vue'
import { REPORT_OUTCOMES } from '@/lib/format/report'

/**
 * The dialog's contract, which is the one part of this flow the automated browser cannot witness:
 * its Select is floating content, and the pane neither closes the listbox nor accepts a keyboard
 * selection through it — see the note in AGENTS.md.
 *
 * Mounted shallow, because what is under test is the guard and the payload rather than shadcn's
 * Select. Its internals are exercised by clicking through the real app.
 */
function closeDialog() {
  return mount(CloseReportDialog, {
    props: { open: true, subject: 'Etwas Übles.', isPending: false },
    shallow: true,
  })
}

/** The component's own state, which is what a shallow mount leaves to reach for directly. */
function state(wrapper: ReturnType<typeof closeDialog>) {
  return wrapper.vm as unknown as {
    outcome: string | undefined
    note: string
    error: string | undefined
    confirm: () => void
  }
}

describe('CloseReportDialog', () => {
  it('refuses a closing with no outcome, and emits nothing', () => {
    const wrapper = closeDialog()
    const vm = state(wrapper)

    vm.note = 'Etwas entschieden.'
    vm.confirm()

    expect(vm.error).toBe('Wähle aus, was aus der Meldung geworden ist.')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('refuses a closing with no note, which is what an outcome alone would lose', () => {
    const wrapper = closeDialog()
    const vm = state(wrapper)

    vm.outcome = 'no_violation'
    // Whitespace only, because that is what an operator pressing Enter in an empty field sends.
    vm.note = '   '
    vm.confirm()

    expect(vm.error).toBe('Schreib kurz, was du entschieden hast.')
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('emits the outcome and the trimmed note', () => {
    const wrapper = closeDialog()
    const vm = state(wrapper)

    vm.outcome = 'content_removed'
    vm.note = '  Beitrag entfernt, Autor informiert.  '
    vm.confirm()

    expect(vm.error).toBeUndefined()
    // Two arguments in this order is what ModerationView's handler reads them as.
    expect(wrapper.emitted('close')).toEqual([
      ['content_removed', 'Beitrag entfernt, Autor informiert.'],
    ])
  })

  it('offers every outcome the API accepts', () => {
    // A value added to the enum and forgotten here would be an outcome no operator can choose.
    // The labels are ours, so only the set can be checked — and it is the set that matters.
    expect(REPORT_OUTCOMES.map((outcome) => outcome.value).sort()).toEqual([
      'account_banned',
      'content_removed',
      'content_warning_added',
      'duplicate',
      'insufficient_information',
      'no_violation',
      'other',
      'target_gone',
      'warning_given',
    ])
  })
})
