import { z } from 'zod'
import type { InputDefinition } from './model'

const formats = { email: z.email(), url: z.url(), number: z.coerce.number(), date: z.iso.date() }

export function validateInputs(inputs: InputDefinition[], values: Record<string, string>): string[] {
  return inputs.flatMap((input) => {
    const value = (values[input.id] ?? '').trim()
    if (input.type === 'checkbox') return input.required && value !== 'true' ? [`Cochez « ${input.label} » pour continuer.`] : []
    if (!value) return input.required ? [`Renseignez « ${input.label} ».`] : []
    if (input.type === 'select') return input.options?.includes(value) ? [] : [`Choisissez une option valide pour « ${input.label} ».`]
    const format = formats[input.type as keyof typeof formats]
    return format && !format.safeParse(value).success ? [`Vérifiez le format de « ${input.label} ».`] : []
  })
}
