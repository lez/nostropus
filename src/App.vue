<template>
  <div>
    <div v-if="!pubkey">Syncronize your events between your relays!</div>
    <button v-if="!pubkey" @click="onLogin">Log in</button>

    <div class="relaygrid" v-if="this.wrelays && this.wrelays.length">
      <div class="line" v-for="r in wrelays">
        <span class="item">icon</span>
        <span class="item">{{r}}</span>
        <span class="item">{{seen[r] && seen[r].created_at}}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import { normalizeURL } from 'nostr-tools/utils'
import { Relay } from 'nostr-tools/relay'

// WE_ARE_HERE: move to composition api (?)

export default defineComponent({
  data() {
    return {
      pubkey: null,
      npub: null,
      pool: new SimplePool(),
      wrelays: null,
      events: {},
      seen: {}  // {relayurl: {event}}
    }
  },
  async mounted() {
    window.app = this
    let pk = window.localStorage.getItem('pubkey')
    if (pk) {
      await new Promise((resolve, reject) => {setTimeout(resolve, 10)})
      this.onLogin()
    }
  },
  methods: {
    updateSeen() {
      for(let value of this.pool.seenOn) {
        let id = value[0]
        let relays = value[1]
        for (let r of relays) {
          console.log(`Add ${id} to`, r.url)
          this.seen[r.url] = this.events[id]
        }
        // console.log(relays)
      }
    },
    async onLogin() {
      let pk = await window.nostr.getPublicKey()
      if (!pk) {
        this.pubkey = null
        this.npub = null
        alert("Login cancelled.")
      }

      window.localStorage.setItem('pubkey', pk)

      this.pubkey = pk
      console.clear()
      console.log(`Pubkey is ${pk}`)

      if (window.nostr.getRelays) {
        let rlist = await window.nostr.getRelays()
        console.log(rlist)

        // TODO: Differentiate read and write relays.
        this.wrelays = Object.keys(rlist).map(normalizeURL)

        this.pool.trackRelays = true

        // Send out the minions.
        let h = this.pool.subscribeMany(this.wrelays, [{authors: [pk], kinds: [0]}], {
          onevent: (event) => {
            this.events[event.id] = event
            console.log(`Event [${event.id}]`)
            this.updateSeen()
            // console.log(this.pool.seenOn)
            // console.log(this.pool.seenOn)
          },
          oneose: () => {
            console.log('EOSE')
            h.close()
            console.log(this.pool.seenOn)
          }
        })

      } else {
        alert("Sorry, nostr.getRelays() must be supported by the extension.")
      }
    }
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
