// Original work Copyright (c) 2018 Terkel Gjervig Nielsen
// Modified work Copyright (c) 2021 James Edwards

'use strict'

const color = require('kleur')
const Prompt = require('./prompt')
const { erase, cursor } = require('sisteransi')
const { style, clear, figures, wrap, entriesToDisplay } = require('../util')
const CancelationToken = require('../util/cancelationToken')

const getVal = (arr, i) => arr[i] && (arr[i].value || arr[i].title || arr[i])

/**
 * AsyncAutocompletePrompt Element
 * @param {Object} opts Options
 * @param {String} opts.message Message
 * @param {Function} opts.suggest Gets choices based on user input
 * @param {Number} [opts.limit=10] Max number of results to show onscreen
 * @param {String} [opts.style='default'] Render style
 * @param {Boolean} [opts.clearFirst] The first ESCAPE keypress will clear the input
 * @param {Stream} [opts.stdin] The Readable stream to listen to
 * @param {Stream} [opts.stdout] The Writable stream to write readline data to
 * @param {Function} [opts.afterRender] called after each render
 */
class AsyncAutocompletePrompt extends Prompt {
  constructor(opts = {}) {
    super(opts)
    this.msg = opts.message
    this.suggest = opts.suggest
    this.suggestions = []
    this.select = 0
    this.clearFirst = opts.clearFirst || false
    this.input = ''
    this.limit = opts.limit || 10
    this.cursor = 0
    this.transform = style.render(opts.style)
    this.scale = this.transform.scale
    this.render = this.render.bind(this)
    this.complete = this.complete.bind(this)
    this.clear = clear('', this.out.columns)
    this.afterRender = opts.afterRender
    this.complete(this.render)
    this.render()
  }

  moveSelect(i) {
    this.select = i
    if (this.suggestions.length > 0) this.value = getVal(this.suggestions, i)
    else this.value = undefined
    this.fire()
  }

  async complete(cb) {
    if (this.cancelationToken) this.cancelationToken.cancel()
    try {
      await this.completing
    } catch (err) {
      // ignore
    }
    const cancelationToken = (this.cancelationToken = new CancelationToken())

    const suggestionsCallback = (suggestions) => {
      if (cancelationToken.canceled) return

      if (cancelationToken !== this.cancelationToken) return
      this.suggestions = suggestions.map((s, i, arr) => ({
        title: s.title,
        value: s.value,
        description: s.description,
      }))
      this.completing = false
      const initialIndex = suggestions.findIndex((s) => s.initial)
      if (initialIndex >= 0) {
        this.moveSelect(initialIndex)
      } else {
        const l = Math.max(suggestions.length - 1, 0)
        this.moveSelect(Math.min(l, this.select))
      }

      this.render()
    }

    const p = (this.completing = this.suggest(
      this.input,
      cancelationToken,
      suggestionsCallback
    ))
    this.render()

    try {
      const suggestions = await p
      if (Array.isArray(suggestions)) suggestionsCallback(suggestions)
    } catch (err) {
      if (!cancelationToken.canceled) throw err
    }
  }

  reset() {
    this.input = ''
    this.complete(this.render)
    this.render()
  }

  exit() {
    if (this.clearFirst && this.input.length > 0) {
      this.reset()
    } else {
      this.done = this.exited = true
      this.aborted = false
      this.fire()
      this.render()
      this.out.write('\n')
      this.close()
    }
  }

  abort() {
    this.done = this.aborted = true
    this.exited = false
    this.fire()
    this.render()
    this.out.write('\n')
    this.close()
  }

  submit() {
    this.done = true
    this.aborted = this.exited = false
    this.fire()
    this.render()
    this.out.write('\n')
    this.close()
  }

  _(c, key) {
    let s1 = this.input.slice(0, this.cursor)
    let s2 = this.input.slice(this.cursor)
    this.input = `${s1}${c}${s2}`
    this.cursor = s1.length + 1
    this.complete(this.render)
    this.render()
  }

  delete() {
    if (this.cursor === 0) return this.bell()
    let s1 = this.input.slice(0, this.cursor - 1)
    let s2 = this.input.slice(this.cursor)
    this.input = `${s1}${s2}`
    this.complete(this.render)
    this.cursor = this.cursor - 1
    this.render()
  }

  deleteForward() {
    if (this.cursor * this.scale >= this.rendered.length) return this.bell()
    let s1 = this.input.slice(0, this.cursor)
    let s2 = this.input.slice(this.cursor + 1)
    this.input = `${s1}${s2}`
    this.complete(this.render)
    this.render()
  }

  first() {
    this.moveSelect(0)
    this.render()
  }

  last() {
    this.moveSelect(this.suggestions.length - 1)
    this.render()
  }

  up() {
    if (this.select === 0) {
      this.moveSelect(this.suggestions.length - 1)
    } else {
      this.moveSelect(this.select - 1)
    }
    this.render()
  }

  down() {
    if (this.select === this.suggestions.length - 1) {
      this.moveSelect(0)
    } else {
      this.moveSelect(this.select + 1)
    }
    this.render()
  }

  next() {
    if (this.select === this.suggestions.length - 1) {
      this.moveSelect(0)
    } else this.moveSelect(this.select + 1)
    this.render()
  }

  nextPage() {
    this.moveSelect(
      Math.min(this.select + this.limit, this.suggestions.length - 1)
    )
    this.render()
  }

  prevPage() {
    this.moveSelect(Math.max(this.select - this.limit, 0))
    this.render()
  }

  left() {
    if (this.cursor <= 0) return this.bell()
    this.cursor = this.cursor - 1
    this.render()
  }

  right() {
    if (this.cursor * this.scale >= this.rendered.length) return this.bell()
    this.cursor = this.cursor + 1
    this.render()
  }

  renderOption(v, hovered, isStart, isEnd) {
    let desc
    let prefix = isStart ? figures.arrowUp : isEnd ? figures.arrowDown : ' '
    let title = hovered ? color.cyan().underline(v.title) : v.title
    prefix = (hovered ? color.cyan(figures.pointer) + ' ' : '  ') + prefix
    if (v.description) {
      desc = ` - ${v.description}`
      if (
        prefix.length + title.length + desc.length >= this.out.columns ||
        v.description.split(/\r?\n/).length > 1
      ) {
        desc =
          '\n' + wrap(v.description, { margin: 3, width: this.out.columns })
      }
    }
    return prefix + ' ' + title + color.gray(desc || '')
  }

  render() {
    if (this.closed) return
    if (this.firstRender) this.out.write(cursor.hide)
    else this.out.write(clear(this.outputText, this.out.columns))
    super.render()

    let { startIndex, endIndex } = entriesToDisplay(
      this.select,
      this.suggestions.length,
      this.limit
    )

    this.outputText = [
      style.symbol(this.done, this.aborted, this.exited),
      color.bold(this.msg),
      style.delimiter(this.completing),
      this.done && this.suggestions[this.select]
        ? this.suggestions[this.select].title
        : (this.rendered = this.transform.render(this.input)),
    ].join(' ')

    if (!this.done) {
      const suggestions = this.suggestions
        .slice(startIndex, endIndex)
        .map((item, i) =>
          this.renderOption(
            item,
            this.select === i + startIndex,
            i === 0 && startIndex > 0,
            i + startIndex === endIndex - 1 &&
              endIndex < this.suggestions.length
          )
        )
        .join('\n')
      this.outputText += `\n` + suggestions
    }

    this.out.write(erase.line + cursor.to(0) + this.outputText)

    if (this.afterRender) this.afterRender()
  }
}

module.exports = AsyncAutocompletePrompt
