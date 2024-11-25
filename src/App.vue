<template>
  <div>
    <div v-if="!pubkey">Syncronize your events between your relays!</div>
    <button v-if="!pubkey" @click="onLogin">Log in</button>

    <div class="relaygrid" v-if="wrelays && wrelays.length">
      <div class="line">
        <span class="item">Relay URL</span>
        <span class="item">Relay List Event</span>
        <span class="item">Profile</span>
      </div>
      <div class="line" v-for="r in wrelays">
        <span class="item">{{r}}</span>
        <span class="item">{{rseen[r] && rseen[r].created_at}}</span>
        <span class="item">{{pseen[r] && pseen[r].created_at}}</span>
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
const profiles = ref({})  // {id: {event}}
const relaylists = ref({})  // {id: {event}}
const pseen = ref({})  // {relayurl: {profile event}}
const rseen = ref({})  // {relayurl: {relaylist event}}

function updateSeen(kind, events, seen) {
  console.log('> updateSeen')
  for(let value of pool.seenOn) {
    console.log('updateSeen', value[0])
    let id = value[0]
    if (id in events) {
      let relays = value[1]
      for (let r of relays) {
        console.log(`Add ${id} to`, r.url)
        seen.value[r.url] = events[id]
      }
    }
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
    let relaylist_latest = 0
    let relaylist_latest_id = null
    let profile_latest = 0
    let profile_latest_id = null

    // Send out the minions.
    let h = pool.subscribeMany(wrelays.value, [{authors: [pk], kinds: [0, 10002]}], {
      onevent: (event) => {
        console.log(`Event [${event.id}] kind [${event.kind}]`)
        switch (event.kind) {
          case 0:
            profiles[event.id] = event
            if (profile_latest < event.created_at) {
              profile_latest = event.created_at
            }
            break
          case 10002:
            relaylists[event.id] = event

            if (relaylist_latest < event.created_at) {
              relaylist_latest = event.created_at
              relaylist_latest_id = event.id
            }
            break

          default:
            throw Error('eek')
        }
      },
      oneose: () => {
        console.log('EOSE')
        h.close()
        updateSeen(0, profiles, pseen)
        updateSeen(10002, relaylists, rseen)
        console.log('profile latest', profile_latest, relaylist_latest)
        console.log('relaylist latest', relaylists[relaylist_latest_id].tags)
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
}
.line {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
</style>
