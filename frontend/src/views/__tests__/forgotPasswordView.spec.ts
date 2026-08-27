import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'

/** Spike: does the schema-driven form actually report the German wording on submit? */
function view() {
  return mount(ForgotPasswordView, {
    global: { plugins: [VueQueryPlugin], stubs: { RouterLink: true } },
    attachTo: window.document.body,
  })
}

describe('ForgotPasswordView (TanStack Form spike)', () => {
  it('reports the missing field in German on an empty submit', async () => {
    const wrapper = view()
    const MESSAGE = 'Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.'

    // Nothing before the member submits, or the assertion below would pass on a form that
    // shouts at people the moment it loads.
    expect(wrapper.text()).not.toContain(MESSAGE)
    expect(wrapper.find('input').attributes('aria-invalid')).toBeUndefined()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.')
    wrapper.unmount()
  })

  it('treats whitespace as missing, which took required plus pattern before', async () => {
    const wrapper = view()
    await wrapper.find('input').setValue('   ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.')
    wrapper.unmount()
  })

  it('marks the field invalid for a screen reader', async () => {
    const wrapper = view()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('input').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })
})
