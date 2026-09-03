<template>
  <div>
    <div v-if="!pubkey">Syncronize your events between your relays!</div>
    <button v-if="!pubkey" @click="onLogin">Log in</button>

    <div class="relaygrid" v-if="relays && relays.length" ref="gridEl">
      <div class="line">
        <span class="item"></span>
        <span class="item">Relay URL</span>
        <span class="item">Error</span>
        <span class="item">Relay List Event</span>
        <span class="item">Profile</span>
        <span class="item">Follows</span>
        <span class="item">Blossom</span>
      </div>

      <div class="line" v-for="r, ridx in relays" @mouseover="dot_hover(ridx)" @mouseleave="dot_blur">
        <div class="item"></div>
        <span class="item relayurl">
          <span :class="{bold: (hovered_relay == ridx)}">{{r.url.replace(/^wss?:\/\//, '')}}</span>
          <span class="yellow">({{ r.note_ids.size }} events)</span>
        </span>
        <span class="item">
          <span v-if="r.error" class="red">{{ r.error }}</span>
        </span>

        <!-- relaylist -->
        <span class="item">
          <div v-if="r.events[10002]" :class="{green: r.events[10002].id == latest_event[10002].id}">{{(new Date(r.events[10002].created_at*1000)).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "numeric", year: "numeric", hour12: false})}}
          </div>
          <div v-if="10002 in r.events && !r.events[10002]" class="red">event not found</div>
        </span>

        <!-- profile -->
        <span class="item">
          <div v-if="r.events[0]" :class="{green: r.events[0].id == latest_event[0].id}">{{(new Date(r.events[0].created_at*1000)).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "numeric", year: "numeric", hour12: false})}}
          </div>
          <div v-if="0 in r.events && !r.events[0]" class="red">event not found</div>
        </span>

        <!-- Follows -->
        <span class="item">
          <div v-if="r.events[3]" :class="{green: r.events[3].id == latest_event[3].id}">{{(new Date(r.events[3].created_at*1000)).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "numeric", year: "numeric", hour12: false})}}
          </div>
          <div v-if="3 in r.events && !r.events[3]" class="red">event not found</div>
        </span>

        <!-- Blossom -->
        <span class="item">
          <div v-if="r.events[10066]" :class="{green: r.events[10066].id == latest_event[10066].id}">{{(new Date(r.events[10066].created_at*1000)).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "numeric", year: "numeric", hour12: false})}}
          </div>
          <div v-if="10066 in r.events && !r.events[10066]" class="red">event not found</div>
        </span>
      </div>

      <div v-for="note in notes" class="note">
        <div class="dots">
          <div v-for="r, idx in relays" class="dot" :class="{green: r.note_ids.has(note.id), bold: idx==hovered_relay}" @mouseover="dot_hover(idx)" @mouseleave="dot_blur"></div>
        </div>
        <span class="note-created-at">{{ (new Date(note.created_at*1000)).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "numeric", year: "numeric", hour12: false}) }}</span>
        <span class="note-content">{{ note.content.substr(0, 81) }}</span>
      </div>

      <svg v-if="tentacles.length" class="tentacles" :width="svgW" :height="svgH" :viewBox="`0 0 ${svgW} ${svgH}`">
        <path v-for="(d, idx) in tentacles" :key="idx" :d="d" :class="{thick: idx == hovered_relay}" />
      </svg>
    </div>
    <button v-if="done" @click="onFix">Fix</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { normalizeURL } from 'nostr-tools/utils'
import { Relay } from 'nostr-tools/relay'

const pubkey = ref(null)
const npub = ref(null)
const relays = ref(null)  // [{url: relayurl, extension: bool, relaylist: bool}]
const pseen = ref({})  // {relayurl: {profile event}}
const rseen = ref({})  // {relayurl: {relaylist event}}
const latest_event = ref({})  // {kind: event}
const done = ref(false)
const bootstrap_only_relays = ref([])
const notes = ref([])
const hovered_relay = ref(-1)
const gridEl = ref(null)
const tentacles = ref([])  // SVG path strings, one per relay
const svgW = ref(0)
const svgH = ref(0)

function redrawTentacles() {
  const grid = gridEl.value
  if (!grid || !relays.value) return
  const gbox = grid.getBoundingClientRect()
  svgW.value = gbox.width
  svgH.value = gbox.height
  const rows = grid.querySelectorAll(':scope > .line')  // first .line is the header
  const firstNote = grid.querySelector('.note')
  if (!firstNote) {
    tentacles.value = []
    return
  }
  const dots = firstNote.querySelectorAll('.dot')
  const paths = []
  for (let i = 0; i < relays.value.length; i++) {
    const row = rows[i + 1]
    const dot = dots[i]
    if (!row || !dot) continue
    const rbox = row.children[1].getBoundingClientRect()
    const dbox = dot.getBoundingClientRect()
    const x0 = rbox.left
    const y0 = rbox.top + rbox.height / 2 - gbox.top
    const x1 = dbox.left + dbox.width / 2 - gbox.left
    const y1 = dbox.top - gbox.top + 4
    const d = `M ${x0} ${y0} C ${x0 + (x1 - x0) * 0.6} ${y0}, ${x1} ${y0 + (y1 - y0) * 0.4}, ${x1} ${y1}`
    paths.push(d)
  }
  tentacles.value = paths
}

let tentacleObserver = null
watch(gridEl, (el, oldEl) => {
  if (oldEl && tentacleObserver) tentacleObserver.unobserve(oldEl)
  if (el) {
    if (!tentacleObserver) tentacleObserver = new ResizeObserver(() => redrawTentacles())
    tentacleObserver.observe(el)
    nextTick(redrawTentacles)
  }
})
watch(() => [relays.value?.length, notes.value.length], () => nextTick(redrawTentacles))

onUnmounted(() => { tentacleObserver?.disconnect() })

// Global but not reactive
let promises = []
let newpromises = [] // temporary list to be added to promises
let note_ids = new Set()
let pk = null

function trackLatest(event, relay_url="some relay") {
  if ((latest_event.value[event.kind]?.created_at || 0) < event.created_at) {
    console.log(`Received new event [${event.id.substr(0,12)}]:[${event.kind}] from [${relay_url}]`)
    latest_event.value[event.kind] = event
    return true
  }
  return false
}

function getOnEventFn(relay) {
  let onEventFn = function (event) {
    switch (event.kind) {
      default:
        relay.events[event.kind] = event
        if (trackLatest(event, relay.url)) {
          console.log(`Received new event [${event.id.substr(0,12)}]:[${event.kind}] from [${relay_url}]`)
        }
        break

      case 10002:
        relay.events[10002] = event
        if (trackLatest(event, relay.url)) {
          for (let t of event.tags) {
            // console.log('tag', t)
            let found = false
            if (t[0] !== 'r') continue
            let nurl = normalizeURL(t[1])
            for (let r of relays.value) {
              if (r.url == nurl) {
                // Updating existing relay props.
                // console.log('Relay is in userlist', r.url)
                r.userlist = true
                found = true
              }
            }
            if (!found) {
              // Add relay to the end of wrelays.
              let nr = {url: nurl, extension: false, userlist: true, events: {}, note_ids: new Set()}
              relays.value.push(nr)
              newpromises.push(
                skyLaunch(
                  relays.value[relays.value.length-1])) // passing the reactive nr
            }
          }
        }
        break
    }
  }
  return onEventFn
}

function skyLaunch(r, kinds=[10002]) {
  // Set out a connection to a new relay
  return new Promise((resolve, reject) => {
    console.assert(r.events)  // It should be set to {}.

    let subparams = {
      onevent: getOnEventFn(r),
      oneose: () => {
        for (let kind of kinds) {
          if (!(kind in r.events)) {
            console.log(`missing kind [${kind}] from`, r.url)
            r.events[kind] = false
          }
        }
        resolve(r.url)
      },
      onclose: (e) => {
        r.error = e
        console.log(r.url, "subscription closed", e)
        reject(e)
      }
    }

    if (!r.relay) {
      r.relay = new Relay(r.url)
      r.relay.connectionTimeout = 2000 // Be strict on first round, retry button will be softer
      console.log(`Connecting to [${r.url}]`)
      r.relay.connect().then(() => {
        // console.log("relay connected", r.url)
        r.relay.subscribe([{authors: [pk], kinds}], subparams)
      })
      .catch(e => {console.log('connect error', e); r.error = e; reject(e)})
    } else {
      console.log("Sending new sub to", r.url, kinds)
      r.relay.subscribe([{authors: [pk], kinds}], subparams)
    }
  })
}

function fetchNotes(r) {
  return new Promise((resolve, reject) => {
    console.assert(r.events)  // It should be set to {}.
    console.assert(r.note_ids)  // It should be set to Set().

    let subparams = {
      onevent: (e) => {
        console.log('onevent', e.id)
        r.note_ids.add(e.id)
        if (note_ids.has(e.id)) {
          console.log('dup event', e.id)
        } else {
          console.log('FIRST event', e.id)
          note_ids.add(e.id)
          notes.value.push(e)
          notes.value.sort((a, b) => {if (a.created_at > b.created_at) return -1; if (a.created_at < b.created_at) return 1; return 0})
        }
      },
      onclose: (e) => {
        //WE_ARE_HERE: what to do here? All oncloses should be disabled when data was fetched from relays.
        r.error = e
        console.log(r.url, "subscription closed", e)
        reject(e)
      }
    }

    console.log("Fetching notest from ", r.url)
    r.relay.subscribe([{authors: [pk], kinds: [1]}], subparams)
  })
}

async function onLogin() {
  pk = await window.nostr.getPublicKey()
  if (pk) {
    window.localStorage.setItem('pubkey', pk)
  } else {
    pubkey.value = null
    npub.value = null
    alert("Login cancelled.")
  }

  pubkey.value = pk
  console.log(`Pubkey is ${pk}`)

  if (window.nostr.getRelays) {
    let rlist = await window.nostr.getRelays()
    console.log(rlist)

    // TODO: Differentiate read and write relays.
    relays.value = Object.keys(rlist || {}).map(
      function(r) {
        return {
          url: normalizeURL(r),
          extension: true,
          userlist: false,
          events: {},
          note_ids: new Set(),
        }
      }
    )
  }

  if (!relays.value?.length) {
    // Extension provided no relays, bootstrap with default relays.
    relays.value = [
      {url: "wss://purplepag.es/", extension: true, userlist: false, events: {}, note_ids: new Set()},
      {url: "wss://nos.lol/", extension: true, userlist: false, events: {}, note_ids: new Set()},
      {url: "wss://relay.damus.io/", extension: true, userlist: false, events: {}, note_ids: new Set()},
    ]
  }

  for (let r of relays.value) {
    promises.push(skyLaunch(r))
  }

  while (true) {
    console.log(`Waiting for [${promises.length}] promises`)
    await Promise.allSettled(promises)
    // Move 10002 relays up the list.
    relays.value.sort((a,b) => {
      if (a.userlist>b.userlist) return -1;
      if (a.userlist<b.userlist) return 1;
      return 0
    })
    // Check if we need to run one more round before going for the actual events.
    if (newpromises.length) {
      console.log("Added", newpromises.length, "new promises")
      promises = promises.concat(newpromises)
      newpromises = []
    } else {
      break
    }
  }
  console.log("We have everything we wanted. Going for the other stuff.")

  // Second round: get important replaceable non-parametric event kinds from important relays only.
  promises = []
  let ul = 0

  for (let r of relays.value) {
    if (r.userlist) {
      promises.push(skyLaunch(r, [0, 3, 10002, 10066]))
      ul = ul + 1
    }
    else {
      r.relay.close()
      bootstrap_only_relays.value.push(r.url)
    }
  }
  relays.value = relays.value.splice(0, ul)

  console.log(`Waiting for [${promises.length}] promises`)
  await Promise.allSettled(promises)

  console.log('Now fetching the notes.')
  promises = []
  for (let r of relays.value) {
    promises.push(fetchNotes(r))
  }

  console.log(`Waiting for [${promises.length}] note fetching promises`)
  await Promise.allSettled(promises)
}

async function onFix() {
  console.log("> onFix")
  let event = relaylists[relaylist_latest_id]
  console.log("The proper relaylist is", event)
  let rfixlist = []
  for (let r of relays.value) {
    if (!r.userlist) continue
    if (rseen.value[r.url]?.created_at === relaylist_latest.value) continue
    rfixlist.push(r.url)
  }
  if (rfixlist.length) {
    console.log("The lagging relays are", rfixlist)
    await Promise.all(pool.publish(rfixlist, event))
    console.log("Fixed relaylists")
  } else {
    console.log("Relay lists are fine")
  }

  let profile = profiles[profile_latest_id]
  console.log("The proper profile is", profile)
  let pfixlist = []
  for (let r of relays.value) {
    if (!r.userlist) continue
    if (pseen.value[r.url]?.created_at === profile_latest.value) continue
    pfixlist.push(r.url)
  }
  if (pfixlist.length) {
    console.log("Profile is missing from relays", pfixlist)
    await Promise.all(pool.publish(pfixlist, profile))
    console.log("Fixed profiles")
  } else {
    console.log("Profiles are fine")
  }
}

async function waitForWindowNostr() {
  let delay = 0
  while (!window.nostr) {
    await new Promise((resolve, reject) => {setTimeout(resolve, Math.floor(delay))})
    delay = delay + 1
    if (delay > 50) {
      console.log("Nostr extension not installed")
      break
    }
  }
}

async function dot_hover(idx) {
  console.log("Hover")
  hovered_relay.value = idx;
}
async function dot_blur() {
  hovered_relay.value = -1;
}

onMounted(async () => {
  console.clear()
  let pk = window.localStorage.getItem('pubkey')
  if (pk) {
    await waitForWindowNostr()
    onLogin()
  }
})
</script>

<style scoped>
.relaygrid {
  display: grid-inline;
  position: relative;
}
.tentacles {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.tentacles path {
  fill: none;
  stroke: var(--purple5);
  stroke-opacity: 0.45;
  stroke-width: 1.5;
  stroke-linecap: round;
  transition: stroke-width 0.15s ease, stroke-opacity 0.15s ease;
}
.tentacles path.thick {
  stroke-width: 4;
  stroke-opacity: 0.9;
}
.line {
  display: grid;
  grid-template-columns: 100px 1fr 0.3fr 0.3fr 0.3fr 0.3fr 0.3fr;
}
.item {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.green {
  color: green;
}
.dot.bold::after {
  transform: scale(1.4);
}
.red {
  color: #b00;
}
.notes {
  display: grid;
  white-space: nowrap;
}
.note-content {
  width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-created-at {
  white-space: nowrap;
  padding-left: 9px;
}
.relayurl {
  padding-left: 18px;
}
.yellow {
  color: yellow;
}
</style>
