import { Actor, HttpAgent } from "@dfinity/agent";
import cron from "node-cron";
import fetch from "node-fetch";
import Metrics, { Frequency } from "../.dfx/local/canisters/Metrics/Metrics.d";
import idlFactory from "../.dfx/local/canisters/Metrics/Metrics.did.js";
import canisterIds from "../.dfx/local/canister_ids.json";
(global as any).fetch = fetch;

const agent = new HttpAgent({ host: "http://127.0.0.1:8000" });
agent.fetchRootKey();
const actor = Actor.createActor<Metrics>(idlFactory, {
  agent,
  canisterId: canisterIds.Metrics.local,
});

let tasks = new Map<bigint, [string, boolean, cron.ScheduledTask]>();

function frequencyToCron(freq: Frequency) {
  if ("Minute" in freq.period) {
    return `*/${freq.n} * * * *`;
  } else if ("Hour" in freq.period) {
    return `* */${freq.n} * * *`;
  } else if ("Day" in freq.period) {
    return `* * */${freq.n} * *`;
  } else {
    throw "invalid frequency";
  }
}

async function main() {
  const attributes = await actor.allActiveAttributes();
  attributes
    .filter(({ polling_frequency }) => !!polling_frequency[0])
    .forEach(({ id, polling_frequency, status }) => {
      const freq = frequencyToCron(polling_frequency[0]!);

      let active = "active" in status;
      if (tasks.has(id)) {
        const job = tasks.get(id)!;
        if (job[0] !== freq) {
          console.log(
            `[${id}] schedule changed from ${tasks.get(id)![0]} to ${freq}`
          );
          job[2].destroy();
        } else {
          return;
        }
        if (job[1] !== active) {
          console.log(`[${id}] active changed from ${job[1]} to ${active}`);
          if (active) {
            job[2].start();
          } else {
            job[2].stop();
          }
        }
      } else {
        console.log(`[${id}] schedule: ${freq}`);
      }

      if (!active) {
        return;
      }

      tasks.set(id, [
        freq,
        active,
        cron.schedule(freq, async () => {
          try {
            const res = await actor.execute(id);
            console.log(`[${id}] execute: ${"ok" in res ? "ok" : res.err}`);
          } catch (error) {
            console.log(`[${id}] execute: ${error.message}`);
          }
        }),
      ]);
    });
}

cron.schedule("* */5 * * *", main);

main();
