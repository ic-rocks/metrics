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
    return `0 */${freq.n} * * *`;
  } else if ("Day" in freq.period) {
    return `0 0 */${freq.n} * *`;
  } else {
    throw "invalid frequency";
  }
}

async function main() {
  const timestamp = new Date().toISOString();
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
            `[${timestamp}] [${id}] schedule changed from ${
              tasks.get(id)![0]
            } to ${freq}`
          );
          job[2].destroy();
        } else {
          return;
        }
        if (active && !job[1]) {
          console.log(`[${timestamp}] [${id}] now active, starting`);
          job[2].start();
        }
      } else {
        console.log(`[${timestamp}] [${id}] schedule: ${freq}`);
      }

      if (!active) {
        return;
      }

      tasks.set(id, [
        freq,
        active,
        cron.schedule(freq, async () => {
          const timestamp = new Date().toISOString();
          try {
            const res = await actor.execute(id);
            let result = "ok";
            if (!("ok" in res)) {
              result = Object.keys(res.err)[0];
              if (result === "AttributePaused") {
                result = `now paused, stopping`;
                tasks.get(id)![2].stop();
              } else if (result === "InvalidId") {
                result = `now deleted, destroying`;
                tasks.get(id)![2].destroy();
              }
            }
            console.log(`[${timestamp}] [${id}] execute: ${result}`);
          } catch (error) {
            console.log(`[${timestamp}] [${id}] execute: ${error.message}`);
          }
        }),
      ]);
    });
}

cron.schedule("* */5 * * *", main);

main();
