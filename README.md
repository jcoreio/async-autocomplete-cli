# async-autocomplete-cli

[![CircleCI](https://circleci.com/gh/jcoreio/async-autocomplete-cli.svg?style=svg)](https://circleci.com/gh/jcoreio/async-autocomplete-cli)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/async-autocomplete-cli.svg)](https://badge.fury.io/js/async-autocomplete-cli)

A CLI prompt that allows the user to select from a list of choices, where the choices are fetched asynchronously
(e.g. from a request to a remote server). The user can type filter text and new choices matching that filter text
will be fetched.

Based upon [`prompts`](https://github.com/terkelg/prompts); this basically a stripped-down fork of that repo.

# Usage Example

```
npm i --save async-autocomplete-cli
```

```js
const { asyncAutocomplete } = require('async-autocomplete-cli')

async function go() {
  const instance = await asyncAutocomplete({
    message: 'Select an AWS EC2 Instance',
    suggest: async (input, cancelationToken, yield) => {
      const results = []
      if (!input) {
        // getRecentSelectedInstances not implemented in this example.
        results.push(...(await getRecentSelectedInstances()))
        yield(results)
      }

      const Filters = []
      if (input)
        Filters.push({
          Name: 'tag:Name',
          Values: [`*${input}*`],
        })
      const args = { MaxResults: 100 }
      if (Filters.length) args.Filters = Filters
      const request = ec2.describeInstances(args)
      cancelationToken.on('canceled', () => request.abort())

      if (cancelationToken.canceled) return []

      const { Reservations } = await request.promise()
      for (const { Instances } of Reservations || []) {
        for (const Instance of Instances || []) {
          const { InstanceId, Tags = [] } = Instance
          const name = (Tags.find((t) => t.Key === 'Name') || {}).Value
          results.push({
            title: `${InstanceId} ${name || ''}`,
            value: Instance,
            initial: !results.length,
          })
        }
      }

      if (!results.length) {
        results.push({
          title: `No matching EC2 Instances found${
            input ? ` with name starting with ${input}` : ''
          }`,
        })
      }

      return results
    },
  })
}

go()
```

# API

## `asyncAutocomplete(options)`

The `suggest` function will be called with:

- The user input (a string, may be empty)
- A `cancelationToken`. This is an `EventEmitter` that will event `'canceled'` when the user input has changed.
  It also has a `canceled` property that is initially `false` and becomes `true` when the user input has changed.
  You must handle the `'canceled'` event if you want choices for the latest user input to load ASAP.
- A `yield` function you can call with an array of choices objects `[{ title, value }, ...]`. You can also return the
  final choices, but calling this function
  allows you to change the choices even if the user input remains the same. For example, you might want to save what the user has recently selected to a local
  file, and show the recent selections immediately while waiting to load other choices from the server.

### Options

| Param      |    Type    | Description                                                                         |
| ---------- | :--------: | ----------------------------------------------------------------------------------- |
| message    |  `string`  | Prompt message to display                                                           |
| suggest    | `function` | Function to fetch choices                                                           |
| limit      |  `number`  | Max number of results to show. Defaults to `10`                                     |
| style      |  `string`  | Render style (`default`, `password`, `invisible`, `emoji`). Defaults to `'default'` |
| clearFirst | `boolean`  | The first ESCAPE keypress will clear the input                                      |
