<template>
  <div>
    <div v-if="!pubkey">Syncronize your events between your relays!</div>
    <button v-if="!pubkey" @click="onLogin">Log in</button>

    <div class="relaygrid" v-if="wrelays && wrelays.length">
      <div class="line" v-for="r in wrelays">
        <span class="item">icon</span>
        <span class="item">{{r}}</span>
        <span class="item">{{seen[r] && seen[r].created_at}}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import { normalizeURL } from 'nostr-tools/utils'
import { Relay } from 'nostr-tools/relay'

const pubkey = ref(null)
const npub = ref(null)
const pool = new SimplePool()
const wrelays = ref(null)  // [relayurl]
const events = ref({})  // {id: {event}}
const seen = ref({})  // {relayurl: {event}}

function updateSeen() {
  console.log('updateSeen')
  for(let value of pool.seenOn) {
    console.log('updateSeen', value[0])
    let id = value[0]
    let relays = value[1]
    for (let r of relays) {
      console.log(`Add ${id} to`, r.url)
      seen.value[r.url] = events[id]
    }
    // console.log(relays)
  }
}

async function onLogin() {
  let pk = await window.nostr.getPublicKey()
  if (!pk) {
    pubkey.value = null
    npub.value = null
    alert("Login cancelled.")
  }

  window.localStorage.setItem('pubkey', pk)

  pubkey.value = pk
  console.clear()
  console.log(`Pubkey is ${pk}`)

  if (window.nostr.getRelays) {
    let rlist = await window.nostr.getRelays()
    console.log(rlist)

    // TODO: Differentiate read and write relays.
    wrelays.value = Object.keys(rlist).map(normalizeURL)

    pool.trackRelays = true

    // Send out the minions.
    let h = pool.subscribeMany(wrelays.value, [{authors: [pk], kinds: [0]}], {
      onevent: (event) => {
        events[event.id] = event
        console.log(`Event [${event.id}]`)
        updateSeen()
        // console.log(pool.seenOn)
        // console.log(pool.seenOn)
      },
      oneose: () => {
        console.log('EOSE')
        h.close()
        console.log(pool.seenOn)
      }
    })

  } else {
    alert("Sorry, nostr.getRelays() must be supported by the extension.")
  }
}

onMounted(async () => {
  // window.app = module
  let pk = window.localStorage.getItem('pubkey')
  if (pk) {
    await new Promise((resolve, reject) => {setTimeout(resolve, 1000)})
    onLogin()
  }
})
</script>

<style scoped>
.relaygrid {
  display: grid-inline;
  /*grid-template-columns: 0.1fr 1fr 1fr;*/
  gap: 1rem;
}
.line {
  display: grid;
  grid-template-columns: 0.1fr 1fr 1fr;
}
</style>
