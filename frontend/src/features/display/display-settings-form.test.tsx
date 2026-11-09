import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { EventItem } from '@/types'
import { DisplaySettingsForm } from './display-settings-form'

const event = {
  id: 1, organization_name: 'Faculty', organization_logo_url: null, public_subtitle: 'Year 4', display_visibility: 'rank_and_score',
} as EventItem

function setup() {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onUploadLogo = vi.fn().mockResolvedValue(undefined)
  render(<DisplaySettingsForm event={event} onSave={onSave} onUploadLogo={onUploadLogo} onRemoveLogo={vi.fn()} />)
  return { onSave, onUploadLogo }
}

describe('DisplaySettingsForm', () => {
  it('saves the organization, subtitle and visibility', async () => {
    const { onSave } = setup()

    await userEvent.selectOptions(screen.getByLabelText('What the public will see'), 'rank_only')
    await userEvent.click(screen.getByRole('button', { name: 'Save display settings' }))

    expect(onSave).toHaveBeenCalledWith({ organization_name: 'Faculty', public_subtitle: 'Year 4', display_visibility: 'rank_only' })
    expect(await screen.findByText('Display settings saved.')).toBeInTheDocument()
  })

  it('rejects an organization name that is too long', async () => {
    const { onSave } = setup()

    const name = screen.getByLabelText('Organization name')
    await userEvent.clear(name)
    await userEvent.type(name, 'a'.repeat(151))
    await userEvent.click(screen.getByRole('button', { name: 'Save display settings' }))

    expect(await screen.findByText('Use at most 150 characters')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('only accepts PNG, JPG or WebP logos', async () => {
    const { onUploadLogo } = setup()

    await userEvent.upload(screen.getByLabelText('Organization logo'), new File(['x'], 'a.svg', { type: 'image/svg+xml' }), { applyAccept: false })
    expect(await screen.findByText('Choose a PNG, JPG or WebP image')).toBeInTheDocument()
    expect(onUploadLogo).not.toHaveBeenCalled()

    await userEvent.upload(screen.getByLabelText('Organization logo'), new File(['x'], 'a.png', { type: 'image/png' }))
    expect(onUploadLogo).toHaveBeenCalledTimes(1)
  })
})