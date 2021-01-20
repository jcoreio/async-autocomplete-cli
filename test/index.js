'use strict'

const dedent = require('dedent')
const { expect } = require('chai')
const { PassThrough } = require('stream')
const { asyncAutocomplete } = require('..')
const { style, strip, figures } = require('../util')

const up = '\u001b[A'
const down = '\u001b[B'
const enter = String.fromCharCode(13)

const delay = wait => new Promise(resolve => setTimeout(resolve, wait))

function testAsyncAutocomplete(options) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  stdout.columns = 80

  let currentOutput = ''
  let nextOutput = ''

  const afterRender = () => {
    currentOutput = nextOutput
    nextOutput = ''
  }

  stdout.on('data', chunk => {
    nextOutput += chunk.toString('utf8')
  })

  const result = asyncAutocomplete({ ...options, stdin, stdout, afterRender })
  return {
    stdin,
    stdout,
    result,
    currentOutput() {
      return currentOutput
    },
  }
}

describe('asyncAutocomplete', function() {
  it('works', async function() {
    const recent = [
      { title: 'Foo (recent)', value: 'foo' },
      { title: 'Bar (recent)', value: 'bar' },
    ]
    const { stdin, result, currentOutput } = testAsyncAutocomplete({
      message: 'select an option',
      suggest: async (input, token, yieldChoices) => {
        const result = []
        if (!input) {
          result.push(...recent)
          yieldChoices(result)
        }
        await new Promise((resolve, reject) => {
          token.once('canceled', reject)
          setTimeout(resolve, 10)
        })
        result.push(
          ...[1, 2, 3].map((num, idx) => ({
            title: `${input || ''} ${num}`,
            value: num,
            initial: idx === 0,
          }))
        )

        return result
      },
    })

    await delay(5)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(true)} 
          ${figures.pointer}   Foo (recent)
              Bar (recent)        
        `.trim()
      )
    )

    await delay(20)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(false)} 
              Foo (recent)
              Bar (recent)
          ${figures.pointer}    1
               2
               3          
        `.trim()
      )
    )

    stdin.write(down)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(false)} 
              Foo (recent)
              Bar (recent)
               1
          ${figures.pointer}    2
               3          
        `.trim()
      )
    )

    stdin.write(up)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(false)} 
              Foo (recent)
              Bar (recent)
          ${figures.pointer}    1
               2
               3          
        `.trim()
      )
    )

    stdin.write('foo')

    await delay(1)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(true)} foo
              Foo (recent)
              Bar (recent)
          ${figures.pointer}    1
               2
               3          
        `.trim()
      )
    )

    await delay(20)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(false)} foo
          ${figures.pointer}   foo 1
              foo 2
              foo 3          
        `.trim()
      )
    )

    stdin.write(down)

    expect(strip(currentOutput()).trim()).to.equal(
      strip(
        dedent`
          ${style.symbol(
            false,
            false,
            false
          )} select an option ${style.delimiter(false)} foo
              foo 1
          ${figures.pointer}   foo 2
              foo 3          
        `.trim()
      )
    )
    stdin.write(enter)
    expect(await result).to.equal(2)
  })
})
