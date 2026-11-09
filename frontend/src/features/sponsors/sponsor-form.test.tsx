import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SponsorForm } from './sponsor-form'

const png = () => new File(['x'], 'logo.png', { type: 'image/png' })

describe('SponsorForm', () => {
  it('needs a name and a logo', async () => {
    const onSubmit = vi.fn()
    render(<SponsorForm onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Add sponsor' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(await screen.findByText('Choose a logo')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects files that are not PNG, JPG or WebP', async () => {
    render(<SponsorForm onSubmit={vi.fn()} />)

    await userEvent.upload(screen.getByLabelText('Logo'), new File(['x'], 'a.pdf', { type: 'application/pdf' }), { applyAccept: false })

    expect(await screen.findByText('Choose a PNG, JPG or WebP image')).toBeInTheDocument()
  })

  it('submits the name, level and logo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SponsorForm onSubmit={onSubmit} />)
    const file = png()

    await userEvent.type(screen.getByLabelText('Sponsor name'), 'Acme')
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'diamond')
    await userEvent.upload(screen.getByLabelText('Logo'), file)
    await userEvent.click(screen.getByRole('button', { name: 'Add sponsor' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Acme', tier: 'diamond', logo: file })
  })
})