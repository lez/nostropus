<template>
  <div>
    <div v-if="!pubkey">Syncronize your events between your relays!</div>
    <button v-if="!pubkey" @click="onLogin">Log in</button>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  data() {
    return {
      pubkey: null,
      npub: null,
    }
  },
  methods: {
    async onLogin() {
      let pk = await window.nostr.getPublicKey()
      if (!pk) {
        this.pubkey = null
        this.npub = null
        alert("Login cancelled.")
      }
      this.pubkey = pk
      console.log(`Pubkey is ${pk}`)

      let rlist = await window.nostr.getRelays()
      let all_relays = Object.keys(rlist) // Read and write relays.
    }
  }
})
</script>

<style scoped>
</style>
