<template>
  <div class="app">
    <div class="header">
      <img class="logo" height="100" src="/img/nostropus.png">

      <div class="headside">
        <div class="headline">Nostropus</div>
        <div class="slogan"><span class="our">Optimize your reach</span></div>
      </div>
      <div class="flex-space"></div>
      <div v-if="pubkey" class="userpill" :style="{borderColor: pillColor}" @click.stop="pillMenu = !pillMenu">
        <template v-if="pillMeta">
          <img v-if="pillMeta.picture" class="pillavatar" :src="pillMeta.picture">
          <span>{{ pillMeta.name || pillNpub12 }}</span>
        </template>
        <template v-else>
          <span>{{ pillNpub12 }}</span>
        </template>
        <span class="pillcaret"></span>

        <div v-if="pillMenu" class="pillmenu" @click.stop>
          <div class="pillmenuitem" @click="pillMenu = false; onCopyNpub()">Copy npub</div>
          <div class="pillmenuitem" @click="pillMenu = false; switchModal = true">Switch user (to anyone)</div>
          <div v-if="pubkeySource === 'external'" class="pillmenuitem" @click="pillMenu = false; cleanup(); onLogin()">Log in via extension</div>
          <div class="pillmenuitem" @click="pillMenu = false; onLogout()">Log out</div>
        </div>
      </div>
      <div class="fixbox">
        <span></span>
      </div>
    </div>

    <div v-if="!pubkey" class="landing">
      <div class="landingbuttons">
        <button @click="onLogin">Log in</button>
        <button @click="switchModal = true">View any nostr user</button>
      </div>
      <div class="cards">
        <div class="card">
          <div class="cardtitle">Be sure to reach your audience!</div>
          <div class="cardtext">Put your notes right where your followers are looking at.</div>
        </div>
        <div class="card">
          <div class="cardtitle">Prevent old notes from disappearing</div>
          <div class="cardtext">Make sure they are stored at multiple locations.</div>
        </div>
        <div class="card">
          <div class="cardtitle">Gain deeper understanding</div>
          <div class="cardtext">See with your own eyes. A beautiful visualization helps you through the ocean of data.</div>
        </div>
      </div>
    </div>

    <div v-if="switchModal" class="modalbg" @click.self="switchModal = false">
      <div class="modal">
        <div class="modaltitle">Switch user (to anyone)</div>
        <input class="modalinput" v-model="switchInput" placeholder="npub1... or name@domain.lol" @keyup.enter="onSwitchGo" @input="switchError = ''" ref="switchInputEl">
        <div class="modalerror" v-if="switchError">{{ switchError }}</div>
        <button class="modalgo" @click="onSwitchGo">Go</button>
      </div>
    </div>

    <div class="relaygrid" v-if="relays && relays.length" ref="gridEl" :style="{'--ndots': relays.length}">
      <table class="relaytable">
        <thead>
          <tr class="bold">
            <th class="tentaclecol">
              <!-- Hidden dots line: stretches this column to match the dots
                   column width in the note grid (N dots * 1.6em). -->
              <div class="dots dots-hidden" v-if="notes.length">
                <div v-for="r in relays" :key="r.url" class="dot"></div>
              </div>
            </th>
            <th>Relay</th>
            <th>Notes</th>
            <th>Status</th>
            <th title="kind 10002">Relay List</th>
            <th title="kind 0">Profile</th>
            <th title="kind 3">Follows</th>
            <th title="kind 10063">Blossom</th>
          </tr>
        </thead>
        <tbody>
          <tr class="relayline" v-for="r, ridx in relays" @mouseover="dot_hover(ridx)" @mouseleave="dot_blur">
            <td class="tentacles"></td>
            <td class="relayurl">
              <span :class="{hovered: (hovered_relay == ridx)}">{{r.url.replace(/^wss?:\/\//, '').replace(/\/$/, '')}}</span>
            </td>
            <td>
              <span v-if="r.note_ids.size > 0" :class="{green: r.eosed && r.note_ids.size == notes.length, yellow: r.eosed && r.note_ids.size < notes.length}">{{ r.note_ids.size }}</span>
              <button v-if="fixReady && r.eosed && r.note_ids.size < notes.length" class="fixbtn small ready" :disabled="fixing" @click="onFixEvents(r)"><svg class="fixicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><line x1="3.5" y1="20.5" x2="9" y2="15" stroke-width="5"/><line x1="10" y1="14" x2="18" y2="6" stroke-width="2"/><line x1="15.8" y1="3.8" x2="18.2" y2="6.2" stroke-width="2.2"/></svg> fix</button>
            </td>
            <td>
              <span v-if="r.error" class="errpill" :title="String(r.error)">{{ formatError(r.error) }}</span>
              <a v-if="r.error" class="retrylink" :class="{disabled: r.retrying}" @click="onRetry(r)">{{ r.retrying ? 'retrying...' : 'retry' }}</a>
              <span v-if="r.progress" class="relayprogress">{{ r.progress }}</span>
            </td>

            <!-- relaylist -->
            <td>
              <div v-if="r.events[10002]" :class="{green: r.events[10002].id == latest_event[10002].id}" :title="formatFullTime(r.events[10002].created_at)">{{ formatTime(r.events[10002].created_at) }}
              </div>
              <div v-if="10002 in r.events && !r.events[10002]" class="red">event not found</div>
            </td>

            <!-- profile -->
            <td>
              <div v-if="r.events[0]" :class="{green: r.events[0].id == latest_event[0].id}" :title="formatFullTime(r.events[0].created_at)">{{ formatTime(r.events[0].created_at) }}
              </div>
              <div v-if="0 in r.events && !r.events[0]" class="red">event not found</div>
            </td>

            <!-- Follows -->
            <td>
              <div v-if="r.events[3]" :class="{green: r.events[3].id == latest_event[3].id}" :title="formatFullTime(r.events[3].created_at)">{{ formatTime(r.events[3].created_at) }}
              </div>
              <div v-if="3 in r.events && !r.events[3]" class="red">event not found</div>
            </td>

            <!-- Blossom -->
            <td>
              <div v-if="r.events[10063]" :class="{green: r.events[10063].id == latest_event[10063].id}" :title="formatFullTime(r.events[10063].created_at)">{{ formatTime(r.events[10063].created_at) }}
              </div>
              <div v-if="10063 in r.events && !r.events[10063]" class="red">event not found</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-for="note in notes" :key="note.id" class="note">
        <div class="dots">
          <div v-for="r, idx in relays" class="dot"
            :class="{green: r.note_ids.has(note.id), yellow: r.limited_note_id == note.id, hollow: r.unreachable, unknown: !r.unreachable && !r.eosed && noteOutOfRange(r, note), bold: idx==hovered_relay}"
            @mouseover="dot_hover(idx)" @mouseleave="dot_blur"></div>
        </div>
        <span class="note-created-at" :title="formatFullTime(note.created_at)">{{ formatTime(note.created_at) }}</span>
        <span class="note-content">{{ note.content.substr(0, 81) }}</span>
      </div>

      <svg v-if="tentacles.length" class="tentacles" :width="svgW" :height="svgH" :viewBox="`0 0 ${svgW} ${svgH}`">
        <path v-for="(d, idx) in tentacles" :key="idx" :d="d" :class="{thick: idx == hovered_relay}" />
      </svg>
    </div>

    <div class="appfooter">
      Created out of frustration but with love by
      <a href="https://jumble.social/npub1elta7cneng3w8p9y4dw633qzdjr4kyvaparuyuttyrx6e8xp7xnq32cume">@lez</a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { normalizeURL } from 'nostr-tools/utils'
import { Relay } from 'nostr-tools/relay'
import { nip19 } from 'nostr-tools'
import { queryProfile } from 'nostr-tools/nip05'

const pubkey = ref(null)
const pubkeySource = ref(null)  // 'extension' | 'external' — where the current pubkey came from
const npub = ref(null)
const relays = ref(null)  // [{url: relayurl, extension: bool, relaylist: bool}]
const pillMenu = ref(false)
const pillMeta = ref(null)  // {name, picture} | null — parsed latest kind-0 content
const pillColor = computed(() => pubkey.value ? '#' + pubkey.value.slice(0, 6) : '#888')
const pillNpub12 = computed(() => pubkey.value ? nip19.npubEncode(pubkey.value).slice(0, 12) + '…' : '')
const pseen = ref({})  // {relayurl: {profile event}}
const rseen = ref({})  // {relayurl: {relaylist event}}
const latest_event = ref({})  // {kind: event}
const fixReady = ref(false)
const fixing = ref(false)
const bootstrap_only_relays = ref([])
const notes = ref([])
const hovered_relay = ref(-1)
const gridEl = ref(null)
const tentacles = ref([])  // SVG path strings, one per relay
const switchModal = ref(false)
const switchInput = ref('')
const switchError = ref('')
const switchInputEl = ref(null)
watch(switchModal, (open) => {
  if (open) nextTick(() => switchInputEl.value?.focus())
})
const svgW = ref(0)
const svgH = ref(0)

function redrawTentacles() {
  const grid = gridEl.value
  if (!grid || !relays.value) return
  const gbox = grid.getBoundingClientRect()
  svgW.value = gbox.width
  svgH.value = gbox.height
  const rows = grid.querySelectorAll('.relaytable tbody tr.relayline')
  const firstNote = grid.querySelector('.note')
  if (!firstNote) {
    tentacles.value = []
    return
  }
  const dots = firstNote.querySelectorAll('.dot')
  const paths = []
  for (let i = 0; i < relays.value.length; i++) {
    const row = rows[i]
    const dot = dots[i]
    if (!row || !dot) continue
    const rbox = row.children[1].getBoundingClientRect()
    const dbox = dot.getBoundingClientRect()
    const x0 = rbox.left - gbox.left - 5
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

// Parse the latest kind-0 profile event into the pill's {name, picture}.
watch(() => latest_event.value[0], (ev) => {
  if (!ev?.content) return
  try { pillMeta.value = JSON.parse(ev.content) } catch { /* leave null */ }
})

// Close the pill dropdown on any click outside it.
function closePillMenu() { pillMenu.value = false }
onMounted(() => document.addEventListener('click', closePillMenu))
onUnmounted(() => {
  tentacleObserver?.disconnect()
  document.removeEventListener('click', closePillMenu)
})

// Close the switch-user modal on ESC.
function onEscKey(e) {
  if (e.key === 'Escape') switchModal.value = false
}
onMounted(() => document.addEventListener('keydown', onEscKey))
onUnmounted(() => document.removeEventListener('keydown', onEscKey))

// Global but not reactive
let promises = []
let newpromises = [] // temporary list to be added to promises
let note_ids = new Set()
let pk = null
let breakFirstRound = false  // set when a 10002 event covers all its referenced relays

function checkBreak(event) {
  // Every relay referenced by this event's 'r' tags must already have
  // given us a 10002 event (truthy, i.e. not `false`/`undefined`).
  for (const t of event.tags) {
    if (t[0] !== 'r') continue
    let url = t[1]
    try { url = normalizeURL(t[1]) } catch { /* fall back to raw */ }
    const found = relays.value.find(r => r.url === url)
    if (!found || !found.events?.[10002]) return false
  }
  return true
}

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
        if (!breakFirstRound && latest_event.value[10002] && checkBreak(latest_event.value[10002])) {
          breakFirstRound = true
          console.log('10002 coverage complete - skipping the rest of round one')
        }
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
              let nr = {url: nurl, extension: false, userlist: true, events: {}, note_ids: new Set(), note_last_ts: null}
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
      console.log(`Connecting to [${r.url}]`)
      connectRelay(r, 2000).then(connected => {  // Be strict on first round, the retry button is softer
        if (!connected) { reject('websocket error'); return }
        // console.log("relay connected", r.url)
        r.relay.subscribe([{authors: [pk], kinds}], subparams)
      })
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

    // External idle-based EOSE: nostr-tools' built-in fallback fires 4.4s
    // after subscribe even if events are still streaming. Override it to 10
    // minutes as a mere safety net and run our own 4.4s idle timer that is
    // reset on every received event. 4.4s of silence → treat as EOSE.
    let idleTimer = null
    const idleEose = () => {
      if (r.relay.connected) {
        r.eosed = true
      }
      resolve(r.url)  // no-op if already settled by a real EOSE or close
    }
    const bump = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(idleEose, 4400)
    }

    let subparams = {
      onevent: (e) => {
        bump()  // Reset the idle timer on each received event.
        console.log('onevent', e.id)
        r.note_ids.add(e.id)
        // Track the last (oldest) note timestamp the relay delivered
        if (!r.eosed) r.note_last_ts = e.created_at
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
        clearTimeout(idleTimer)  // Real EOSE wins over the idle guess.
        if (r.relay.connected) {
          r.eosed = true
        }
        resolve(r.url)
      },
      onclose: (e) => {
        //WE_ARE_HERE: what to do here? All oncloses should be disabled when data was fetched from relays.
        clearTimeout(idleTimer)
        r.error = e
        console.log(r.url, "subscription closed", e)
        reject(e)
      },
      eoseTimeout: 60 * 24 * 60 * 1000  // 1 day timeout; the idle timer is the real EOSE timeout.
    }

    console.log("Fetching notest from ", r.url)
    bump()  // Arm the idle timer: 4.4s of silence from now counts as EOSE.
    r.relay.subscribe([{authors: [pk], kinds: [1]}], subparams)
  })
}

// True when the note is older than the oldest note this relay delivered:
// the relay apparently doesn't keep notes that far back. note_last_ts is
// null until the relay delivers any note.
function noteOutOfRange(r, note) {
  if (r.eosed) return false
  return note.created_at < r.note_last_ts
}

async function onLogin() {
  pk = await window.nostr.getPublicKey()
  if (pk) {
    window.localStorage.setItem('pubkey', pk)
    window.localStorage.setItem('pubkey_source', 'extension')
    pubkeySource.value = 'extension'
  } else {
    pubkey.value = null
    npub.value = null
    alert("Login cancelled.")
    return
  }
  await startSession(pk)
}

async function startSession(targetPk) {
  pk = targetPk
  pubkey.value = pk
  console.log(`Pubkey is ${pk}`)

  if (window.nostr?.getRelays) {
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
          note_last_ts: null,
        }
      }
    )
  }

  if (!relays.value?.length) {
    // Extension provided no relays, bootstrap with default relays.
    relays.value = [
      {url: "wss://purplepag.es/", extension: true, userlist: false, events: {}, note_ids: new Set(), note_last_ts: null},
      {url: "wss://nos.lol/", extension: true, userlist: false, events: {}, note_ids: new Set(), note_last_ts: null},
      {url: "wss://relay.damus.io/", extension: true, userlist: false, events: {}, note_ids: new Set(), note_last_ts: null},
    ]
  }

  for (let r of relays.value) {
    promises.push(skyLaunch(r))
  }

  if (promises.length === 0) {
    alert("Could not find a relay list for npub")
  }

  breakFirstRound = false
  while (true) {
    // Iteration for the following edge case:
    // * purplepag.es has a relay list with created_at=x
    // * one of the relays in the list has a relay list event with created_at=x+1
    // * the new relay list has a relay with a relay list event whose created_at=x+2
    // * and so on...
    console.log(`Waiting for [${promises.length}] promises`)
    await Promise.race([
      Promise.allSettled(promises),
      new Promise(resolve => {
        const timer = setInterval(() => {
          if (breakFirstRound) { clearInterval(timer); resolve() }
        }, 100)
      })
    ])
    if (breakFirstRound) {
      console.log(`Breaking first round early, [${promises.length}] promises still in flight`)
      break
    }
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

  // If round one was broken early, helpers relays discovered later may still
  // be pending. Sync the relay list with the latest 10002 event's tags:
  // keep existing relay objects (connections/events intact), add missing,
  // close connections dropped from the list.
  const latestList = latest_event.value[10002]
  if (breakFirstRound && latestList) {
    const byUrl = new Map(relays.value.map(r => [r.url, r]))
    const synced = []
    for (const t of latestList.tags) {
      if (t[0] !== 'r') continue
      let url = t[1]
      try { url = normalizeURL(t[1]) } catch { /* fall back to raw */ }
      let existing = byUrl.get(url)
      if (existing) {
        existing.userlist = true
      } else {
        existing = {url, extension: false, userlist: true, events: {}, note_ids: new Set(), note_last_ts: null}
      }
      synced.push(existing)
      byUrl.delete(url)
    }
    for (const orphan of byUrl.values()) {
      orphan.relay?.close()
    }
    relays.value = synced
  }

  // Second round: get important replaceable non-parametric event kinds from important relays only.
  promises = []
  let ul = 0

  for (let r of relays.value) {
    if (r.userlist) {
      promises.push(skyLaunch(r, [0, 3, 10002, 10063]))
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

function onCopyNpub() {
  if (!pubkey.value) return
  navigator.clipboard.writeText(nip19.npubEncode(pubkey.value))
}

function cleanup() {
  window.localStorage.clear()
  for (let r of relays.value || []) {
    r.relay?.close()
  }
  pubkey.value = null
  pubkeySource.value = null
  npub.value = null
  pillMeta.value = null
  relays.value = null
  pseen.value = {}
  rseen.value = {}
  latest_event.value = {}
  fixReady.value = false
  fixing.value = false
  bootstrap_only_relays.value = []
  notes.value = []
  hovered_relay.value = -1
  tentacles.value = []
  breakFirstRound = false
  promises = []
  newpromises = []
  note_ids = new Set()
  pk = null
}

function onLogout() {
  cleanup()
}

async function resolveSwitchPk(input) {
  input = input.trim()
  if (!input) throw new Error('Enter an npub or a NIP-05 identifier.')
  // Bare npub.
  if (input.startsWith('npub1')) {
    const decoded = nip19.decode(input)
    if (decoded.type !== 'npub') throw new Error('Not an npub.')
    return decoded.data
  }
  // NIP-05 identifier: name@domain (bare domain means name="_").
  const at = input.lastIndexOf('@')
  const name = at >= 0 ? input.slice(0, at).toLowerCase() : '_'
  const domain = at >= 0 ? input.slice(at + 1).toLowerCase() : input.toLowerCase()
  if (!domain.includes('.')) throw new Error('Enter an npub or a NIP-05 identifier (name@domain).')
  const profile = await queryProfile(`${name}@${domain}`)
  if (!profile?.pubkey) throw new Error('NIP-05 lookup returned no pubkey.')
  return profile.pubkey
}

async function onSwitchGo() {
  switchError.value = ''
  try {
    const target = await resolveSwitchPk(switchInput.value)
    cleanup()

    switchModal.value = false
    switchInput.value = ''

    // Log straight in with the new pubkey, without needing the extension.
    window.localStorage.setItem('pubkey', target)
    window.localStorage.setItem('pubkey_source', 'external')
    pubkeySource.value = 'external'
    await startSession(target)
  } catch (err) {
    switchError.value = String(err.message || err)
  }
}

function formatTime(ts) {
  // ts: unix seconds. Relative for recent, absolute for older.
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return `${Math.max(0, Math.floor(diff))}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 14 * 86400) return `${Math.floor(diff / 86400)}d`
  const d = new Date(ts * 1000)
  const month = d.toLocaleString("en-US", {month: "short"})
  if (diff < 182 * 86400) return `${d.getDate()} ${month}`
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function formatFullTime(ts) {
  // e.g. "13 May 2025 13:25"
  const d = new Date(ts * 1000)
  const month = d.toLocaleString("en-US", {month: "short"})
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${month} ${d.getFullYear()} ${hh}:${mm}`
}

function displayUrl(url) {
  return url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
}

// Connect to a relay: up to 3 attempts with the given per-attempt timeout,
// and at least 5 seconds between two attempts. Progress is shown in the
// relay's Error column as 'Connecting... (n/3)'. Returns whether it is now
// connected; on failure r.error and r.unreachable are set.
async function connectRelay(r, timeout = 5000) {
  for (let attempt = 1; !r.relay.connected && attempt <= 3; attempt++) {
    r.progress = `Connecting... (${attempt}/3)`
    r.relay.connectionTimeout = timeout
    const started = Date.now()
    try { await r.relay.connect() } catch (e) { r.error = e }
    const elapsed = Date.now() - started
    if (!r.relay.connected && attempt < 3 && elapsed < 5000) {
      await new Promise(res => setTimeout(res, 5000 - elapsed))
    }
  }
  if (!r.relay.connected) r.unreachable = true
  r.progress = ''
  return r.relay.connected
}

async function onRetry(r) {
  // Retry the initial connection to this relay, then re-fetch everything.
  if (r.retrying) return
  r.retrying = true
  try { await r.relay.connect() } catch (e) { r.error = e; r.retrying = false; return }

  // Connected now: clear the error, then fetch the replaceable kinds and the notes again.
  r.error = null
  r.unreachable = false
  try { await skyLaunch(r, [0, 3, 10002, 10063]) } catch (e) { console.log('retry skyLaunch rejected', e) }
  try { await fetchNotes(r) } catch (e) { console.log('retry fetchNotes rejected', e) }
  r.retrying = false
}

async function publishOne(r, ev, label) {
  r.progress = label
  await r.relay.publish(ev)
  if (ev.kind === 1) r.note_ids.add(ev.id)  // The relay now stores this note.
  else r.events[ev.kind] = ev               // The relay now stores this event.
}

async function onFixEvents(r) {
  fixing.value = true
  r.fixurl = displayUrl(r.url)

  // Make sure we have a live connection (3 attempts, 5s timeout each).
  if (!await connectRelay(r)) { fixing.value = false; return }
  r.error = null  // Clear any stale error now that we're connected.

  // Upload the replaceable events, then the missing notes, newest first.
  const repl = [[0, 'profile'], [3, 'follows'], [10063, 'blossom'], [10002, 'relay list']]
  const queue = []
  for (let [kind, label] of repl) {
    const ev = latest_event.value[kind]
    if (ev) queue.push({ev, label: `Uploading ${label} event`})
  }
  notes.value.forEach((note, i) => {
    if (!r.note_ids.has(note.id)) queue.push({ev: note, label: `uploading note #${i+1}`})  // Skip notes already stored there.
  })

  let uploaded = 0
  let start = Date.now()
  let lastUpload = 0
  // Upload loop: process events in order. A 'rate-limited' rejection is
  // related to the connection, not the event, so the same event is retried
  // after a cooldown of (elapsed / uploaded) — the observed upload rate,
  // and at least 10 seconds after the failed upload attempt.
  // 'publish timed out' errors belong to the same class: the relay may just
  // be slow to answer. Both are retried indefinitely; any other error
  // aborts this relay.
  let i = 0
  while (i < queue.length) {
    const {ev, label} = queue[i]
    lastUpload = Date.now()
    try {
      await publishOne(r, ev, label)
      uploaded++
      r.limited_note_id = null
      i++
    } catch (e) {
      const msg = String(e.message || e)
      const rateLimited = msg.includes('rate-limited')
      if (!rateLimited && !msg.includes('publish timed out')) {
        r.error = msg  // Non-recoverable error: abort this relay.
        break
      }
      r.limited_note_id = ev.kind === 1 ? ev.id : null  // Show the note's dot in yellow.
      const dt = (Date.now() - start) / Math.max(uploaded, 1)
      r.progress = `${rateLimited ? 'rate limited' : 'publish timed out'}, waiting`
      await new Promise(res => setTimeout(res, dt))
      // At least 10 seconds between the failed upload and the retry.
      const gap = Date.now() - lastUpload
      if (gap < 10000) await new Promise(res => setTimeout(res, 10000 - gap))
    }
  }
  r.limited_note_id = null
  r.progress = 'Done.'
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
  const msg = String(e)
  if (msg.includes('rate-limited')) return 'rate limited'
  return msg.replace(/^relay connection\s*/i, '')
}

onMounted(async () => {
  console.clear()
  let pk = window.localStorage.getItem('pubkey')
  pubkeySource.value = window.localStorage.getItem('pubkey_source')
  if (pk) {
    if (pubkeySource.value === 'external') {
      // External pubkey: no extension needed, start directly with it.
      await startSession(pk)
    } else {
      await waitForWindowNostr()
      onLogin()
    }
  }
})
</script>

<style scoped>
.app {
  padding-bottom: 44px;  /* Room for the fixed footer. */
}
.landing {
  text-align: center;
  margin-top: 64px;
  padding: 0 24px;
}
.landingbuttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}
.landingbuttons button {
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.5em;
  background: var(--purple3);
  color: #fff;
  font-size: 1em;
  cursor: pointer;
}
.landingbuttons button:hover {
  background: var(--purple4);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  max-width: 960px;
  margin: 48px auto 0 auto;
}
.card {
  background: var(--purple2);
  border: 1px solid var(--purple3);
  border-radius: 12px;
  padding: 20px;
  text-align: left;
  color: var(--gray13);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.cardtitle {
  color: var(--purple5);
  font-weight: bold;
  font-size: 1.4rem;
}
.cardtext {
  margin-top: 8px;
  font-size: 0.9em;
  color: var(--gray18);
}
.appfooter {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 8px 12px;
  background: var(--purple1);
  border-top: 1px solid var(--purple2);
  color: var(--gray10);
  font-size: 0.8em;
  z-index: 5;  /* Below the modal overlay (z-index 10). */
}
.relaygrid {
  display: grid;
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
.relaytable {
  width: 100%;
  border-collapse: collapse;
}
.relaytable th, .relaytable td {
  text-align: left;
  padding: 0 8px 0 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.relaytable th.tentaclecol, .relaytable td:first-child {
  width: 100px;  /* Minimum width; grows to fit the hidden dots line. */
  min-width: 100px;
}
.dots-hidden {
  visibility: hidden;  /* Occupies width (and stretches the column) but stays invisible. */
  height: 0;           /* ...without adding vertical space to the header row. */
  overflow: hidden;
}
.relayline > td {
  transition: background 0.15s ease;
}
.relayline:hover > td:not(:first-child) {
  background: var(--purple2);
}
.item {  /* still used by note-row elements */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.green {
  color: green;
}
.yellow {
  color: goldenrod;
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
.retrylink {
  color: var(--purple5);
  text-decoration: underline;
  cursor: pointer;
  padding-left: 0.5em;
  font-size: 0.85em;
}
.retrylink.disabled {
  text-decoration: none;
  cursor: default;
  opacity: 0.6;
}
.relayprogress {  /* Progress text of a running fix, shown as-is in the Error column. */
  color: #777;
  padding-left: 0.5em;
  font-size: 0.85em;
  white-space: nowrap;
}
.notes {
  display: grid;
  white-space: nowrap;
}
.note-content {
  width: 300px;
  padding-left: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-created-at {
  white-space: nowrap;
  padding-left: 9px;
  opacity: 50%;
}
.relayurl {
  padding-left: 18px;
  max-width: 240px;
}
.relayurl span.hovered {  /* Hover emphasis via color only: font weight changes glyph widths and would reflow the column. */
  color: var(--gray17);
}
.fixbox {
  display: flex;
  align-items: center;
  gap: 12px;
  align-self: center;
}
.userpill {
  position: absolute;
  top: 0;
  right: 12px;
  border: 2px solid;
  border-radius: 999px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.userpill:hover {
  background: var(--purple2);
}
.pillcaret {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--gray16);
}
.pillavatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.pillmenu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--gray3);
  border: 1px solid var(--gray5);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  z-index: 20;
  min-width: 180px;
  color: var(--gray16);
}
.pillmenuitem {
  padding: 0.5em 1em;
  cursor: pointer;
  white-space: nowrap;
}
.pillmenuitem:hover {
  background: var(--purple2);
}
.modalbg {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.modal {
  background: var(--gray3);
  border: 1px solid var(--gray5);
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 480px;
  max-width: 90vw;
  color: var(--gray16);
}
.modaltitle {
  font-size: 1.2em;
  font-weight: bold;
}
.modalinput {
  padding: 0.5em;
  font-size: 1em;
  border: 1px solid var(--gray5);
  border-radius: 6px;
  background: var(--gray2);
  color: var(--gray16);
}
.modalinput::placeholder {
  color: var(--gray10);
}
.modalgo {
  align-self: flex-end;
  border: none;
  border-radius: 8px;
  padding: 0.4em 1.5em;
  background: var(--purple3);
  color: #fff;
  cursor: pointer;
}
.modalerror {
  color: #f66;
  font-size: 0.85em;
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
