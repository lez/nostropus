<template>
  <div>
    <div class="header">
      <img class="logo" height="100" src="/img/nostropus.png">

      <div class="">
        <div class="headline">Nostropus</div>
        <div class="slogan"><span class="our">Optimize your reach</span></div>
      </div>
      <div class="flex-space"></div>
      <div class="fixbox">
        <span class="fixprogress">{{ fixProgress }}</span>
      </div>
    </div>

    <div v-if="!pubkey">Syncronize your events between your relays!</div>
    <button v-if="!pubkey" @click="onLogin">Log in</button>

    <div class="relaygrid" v-if="relays && relays.length" ref="gridEl">
      <div class="line bold">
        <span class="item"></span>
        <span class="item">Relay URL</span>
        <span class="item">{{ notes.length }} Notes</span>
        <span class="item">Error</span>
        <span class="item" title="kind 10002">Relay List Event</span>
        <span class="item" title="kind 0">Profile</span>
        <span class="item" title="kind 3">Follows</span>
        <span class="item" title="kind 10066">Blossom</span>
      </div>

      <div class="line relayline" v-for="r, ridx in relays" @mouseover="dot_hover(ridx)" @mouseleave="dot_blur">
        <div class="item"></div>
        <span class="item relayurl">
          <span :class="{bold: (hovered_relay == ridx)}">{{r.url.replace(/^wss?:\/\//, '').replace(/\/$/, '')}}</span>
        </span>
        <span class="item">
          ({{ r.note_ids.size }} notes)
          <button v-if="fixReady && r.eosed && r.note_ids.size < notes.length" class="fixbtn small ready" :disabled="fixing" @click="onFixEvents(r)"><svg class="fixicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><line x1="3.5" y1="20.5" x2="9" y2="15" stroke-width="5"/><line x1="10" y1="14" x2="18" y2="6" stroke-width="2"/><line x1="15.8" y1="3.8" x2="18.2" y2="6.2" stroke-width="2.2"/></svg> fix</button>
        </span>
        <span class="item">
          <span v-if="r.error" class="errpill">{{ formatError(r.error) }}</span>
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
          <div v-for="r, idx in relays" class="dot" :class="{green: r.note_ids.has(note.id), hollow: r.unreachable && !r.note_ids.has(note.id), bold: idx==hovered_relay}" @mouseover="dot_hover(idx)" @mouseleave="dot_blur"></div>
        </div>
        <span class="note-created-at">{{ (new Date(note.created_at*1000)).toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "numeric", year: "numeric", hour12: false}) }}</span>
        <span class="note-content">{{ note.content.substr(0, 81) }}</span>
      </div>

      <svg v-if="tentacles.length" class="tentacles" :width="svgW" :height="svgH" :viewBox="`0 0 ${svgW} ${svgH}`">
        <path v-for="(d, idx) in tentacles" :key="idx" :d="d" :class="{thick: idx == hovered_relay}" />
      </svg>
    </div>
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
const fixReady = ref(false)
const fixing = ref(false)
const fixProgress = ref('')
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
        // A timed-out connection still produces a synthetic EOSE (from the
        // eoseTimeout timer); only trust EOSE from a live connection.
        if (r.relay.connected) {
          for (let kind of kinds) {
            if (!(kind in r.events)) {
              console.log(`missing kind [${kind}] from`, r.url)
              r.events[kind] = false
            }
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
      .catch(e => {console.log('connect error', e); r.error = e; r.unreachable = true; reject(e)})
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
      oneose: () => {
        if (r.relay.connected) {
          r.eosed = true
        }
        resolve(r.url)
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

  if (promises.length === 0) {
    alert("Could not find a relay list for npub")
  }

  while (true) {
    // Iteration for the following edge case:
    // * purplepag.es has a relay list with created_at=x
    // * one of the relays in the list has a relay list event with created_at=x+1
    // * the new relay list has a relay with a relay list event whose created_at=x+2
    // * and so on...
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

  // All fetchNotes promises have settled, fix buttons may appear now.
  fixReady.value = true
}

function displayUrl(url) {
  return url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
}

async function onFixEvents(r) {
  fixing.value = true
  const rurl = displayUrl(r.url)

  // Make sure we have a live connection: 3 attempts, 5s timeout each,
  // with at least 5 seconds between two attempts.
  for (let attempt = 1; !r.relay.connected && attempt <= 3; attempt++) {
    fixProgress.value = `Connecting to ${rurl}... (${attempt}/3)`
    r.relay.connectionTimeout = 5000
    const started = Date.now()
    try { await r.relay.connect() } catch (e) { r.error = e }
    const elapsed = Date.now() - started
    if (!r.relay.connected && attempt < 3 && elapsed < 5000) {
      await new Promise(res => setTimeout(res, 5000 - elapsed))
    }
  }
  if (!r.relay.connected) { fixing.value = false; return }  // Unreachable relay, its error pill is already set.
  r.error = null  // Clear any stale error now that we're connected.

  // Upload the replaceable events, then the missing notes, newest first.
  // Abort on the first failure, keeping its error in the error column.
  const repl = [[0, 'profile'], [3, 'follows'], [10066, 'blossom'], [10002, 'relay list']]
  let failed = false
  for (let [kind, label] of repl) {
    const ev = latest_event.value[kind]
    if (!ev) continue
    fixProgress.value = `${rurl}: Uploading ${label} event`
    try {
      await r.relay.publish(ev)
      r.events[kind] = ev  // The relay now stores this event.
    } catch (e) { r.error = e.message || e; failed = true; break }
  }
  if (!failed) {
    for (let i = 0; i < notes.value.length; i++) {
      if (r.note_ids.has(notes.value[i].id)) continue  // Already stored on this relay.
      fixProgress.value = `${rurl}: uploading note #${i+1}`
      try {
        await r.relay.publish(notes.value[i])
        r.note_ids.add(notes.value[i].id)  // The relay now stores this note.
      } catch (e) { r.error = e.message || e; break }
    }
  }
  fixProgress.value = 'Done.'
  fixing.value = false
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

function formatError(e) {
  return String(e).replace(/^relay connection\s*/i, '')
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
  grid-template-columns: 100px 0.2fr 0.3fr 0.3fr 0.3fr 0.3fr 0.3fr 0.3fr;
}
.relayline > .item {
  transition: background 0.15s ease;
}
.relayline:hover > .item:not(:first-child) {
  background: var(--purple2);
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
.errpill {
  display: inline-block;
  background: #b00;
  color: #fff;
  border-radius: 1em;
  padding: 0 0.6em;
  font-size: 0.85em;
  white-space: nowrap;
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
.fixbox {
  display: flex;
  align-items: center;
  gap: 12px;
  align-self: center;
}
.fixbtn {
  font-size: 1.3em;
  padding: 0.3em 0.9em;
  border: none;
  border-radius: 8px;
  background: var(--gray5);
  color: var(--gray14);
  cursor: not-allowed;
}
.fixbtn.ready {
  background: green;
  color: #fff;
  cursor: pointer;
}
.fixbtn.small {
  font-size: 0.7em;
  padding: 0.1em 0.5em;
  margin-left: 0.6em;
  vertical-align: middle;
}
.fixicon {
  width: 1em;
  height: 1em;
  vertical-align: -0.12em;
}
.fixprogress {
  color: var(--purple5);
  white-space: nowrap;
}
</style>
