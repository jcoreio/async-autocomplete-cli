import { Readable, Writable } from 'stream'

export type Style = 'password' | 'emoji' | 'invisible' | 'default'

export type Choice<V> = {
  title: string
  value: V
  initial?: boolean
}

export type Choices<V> = Choice<V>[]

export type YieldChoices<V> = (choices: Choices<V>) => void

export interface CancelationToken {
  readonly canceled: boolean
  once(event: 'canceled', callback: () => void): void
}

export type AsyncAutocompleteSuggestFunction<V> = (
  input: string,
  cancelationToken: CancelationToken,
  yield: YieldChoices<V>
) => Promise<Choices<V> | void>

export interface AsyncAutocompleteOptions<V> {
  message: string
  suggest: AsyncAutocompleteSuggestFunction<V>
  limit?: number
  style?: Style
  clearFirst?: boolean
  stdin?: Readable
  stdout?: Writable
}

export function asyncAutocomplete<V>(
  options: AsyncAutocompleteOptions<V>
): Promise<V>
