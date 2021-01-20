'use strict'

const el = require('./elements')
const noop = v => v

function toPrompt(type, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = new el[type](args)
    const onAbort = opts.onAbort || noop
    const onSubmit = opts.onSubmit || noop
    const onExit = opts.onExit || noop
    p.on('state', args.onState || noop)
    p.on('submit', x => res(onSubmit(x)))
    p.on('exit', x => res(onExit(x)))
    p.on('abort', x => rej(onAbort(x)))
  })
}

/**
 * Interactive auto-complete prompt that fetches choices asynchronously
 * @param {string} args.message Prompt message to display
 * @param {Function} args.suggest Function to suggest results based on user input.
 * @param {number} [args.limit=10] Max number of results to show
 * @param {string} [args.style="default"] Render style ('default', 'password', 'invisible')
 * @param {boolean} [opts.clearFirst] The first ESCAPE keypress will clear the input
 * @param {function} [args.onRender] On render callback
 * @param {Stream} [args.stdin] The Readable stream to listen to
 * @param {Stream} [args.stdout] The Writable stream to write readline data to
 * @param {Function} [args.afterRender] called after each render
 * @returns {Promise} Promise that resolves to user-selected value
 */
exports.asyncAutocomplete = args => {
  return toPrompt('AsyncAutocompletePrompt', args)
}
