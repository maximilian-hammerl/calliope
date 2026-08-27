import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import DeleteAccountForm from '@/components/settings/DeleteAccountForm.vue'
import PasswordSection from '@/components/settings/PasswordSection.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import VerifyEmailAddressRequiredView from '@/views/VerifyEmailAddressRequiredView.vue'

/**
 * Spike: the migrated forms validate through their shared field schemas. Type-checking a template
 * proves the bindings compile, not that a validator fires — so each form is submitted empty and
 * asked what it says.
 */
const blank = { template: '<div />' }

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: blank },
      { path: '/login', name: 'login', component: blank },
      { path: '/register', name: 'register', component: blank },
      { path: '/forgot-password', name: 'forgotPassword', component: blank },
    ],
  })
}

async function submitEmpty(component: Component) {
  const wrapper = mount(component, {
    global: { plugins: [VueQueryPlugin, router()], stubs: { RouterLink: true } },
    attachTo: window.document.body,
  })
  await wrapper.find('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('the migrated forms', () => {
  it('LoginView names both empty fields', async () => {
    const wrapper = await submitEmpty(LoginView)

    expect(wrapper.text()).toContain('Gib deinen Benutzernamen oder deine E-Mail-Adresse ein.')
    expect(wrapper.text()).toContain('Gib dein Passwort ein.')
    wrapper.unmount()
  })

  it('RegisterView names all four, each in its own words', async () => {
    const wrapper = await submitEmpty(RegisterView)

    for (const message of [
      'Gib einen Benutzernamen ein.',
      'Gib eine E-Mail-Adresse ein.',
      'Wähle ein Passwort.',
      'Wiederhole dein Passwort.',
    ]) {
      expect(wrapper.text()).toContain(message)
    }
    wrapper.unmount()
  })

  it('RegisterView marks only the repeat when the two passwords differ', async () => {
    const wrapper = mount(RegisterView, {
      global: { plugins: [VueQueryPlugin, router()], stubs: { RouterLink: true } },
      attachTo: window.document.body,
    })
    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('federkiel')
    await inputs[1]?.setValue('federkiel@example.org')
    await inputs[2]?.setValue('geheim-genug')
    await inputs[3]?.setValue('etwas-anderes')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // The password itself is not wrong; the second field disagrees with it.
    expect(wrapper.text()).toContain('Die Passwörter stimmen nicht überein.')
    expect(wrapper.text()).not.toContain('Wähle ein Passwort.')
    wrapper.unmount()
  })

  it('PasswordSection names all three, each in its own words', async () => {
    const wrapper = await submitEmpty(PasswordSection)

    for (const message of [
      'Gib dein aktuelles Passwort ein.',
      'Wähle ein neues Passwort.',
      'Wiederhole dein neues Passwort.',
    ]) {
      expect(wrapper.text()).toContain(message)
    }
    wrapper.unmount()
  })

  it('PasswordSection marks only the repeat when the two differ', async () => {
    const wrapper = mount(PasswordSection, {
      global: { plugins: [VueQueryPlugin, router()], stubs: { RouterLink: true } },
      attachTo: window.document.body,
    })
    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('altes-passwort')
    await inputs[1]?.setValue('neues-passwort')
    await inputs[2]?.setValue('etwas-anderes')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Die Passwörter stimmen nicht überein.')
    expect(wrapper.text()).not.toContain('Wähle ein neues Passwort.')
    wrapper.unmount()
  })

  it('DeleteAccountForm asks for the current password', async () => {
    const wrapper = await submitEmpty(DeleteAccountForm)

    expect(wrapper.text()).toContain('Gib dein aktuelles Passwort ein.')
    wrapper.unmount()
  })

  // Only reachable in a browser with an *unverified* account, so this is the only cover it has.
  it('VerifyEmailAddressRequiredView validates the corrected address', async () => {
    const wrapper = mount(VerifyEmailAddressRequiredView, {
      global: { plugins: [VueQueryPlugin, router()], stubs: { RouterLink: true } },
      attachTo: window.document.body,
    })
    await flushPromises()

    const correct = wrapper.findAll('button').find((b) => b.text().includes('Adresse ändern'))
    await correct?.trigger('click')
    await flushPromises()

    await wrapper.find('input').setValue('keine-adresse')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Das sieht nicht nach einer E-Mail-Adresse aus.')
    wrapper.unmount()
  })
})
