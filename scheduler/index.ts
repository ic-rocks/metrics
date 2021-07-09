import { Actor, HttpAgent } from "@dfinity/agent";
import cron from "node-cron";
import fetch from "node-fetch";
import Metrics, { Frequency } from "../.dfx/ic/canisters/Metrics/Metrics.d";
import idlFactory from "../.dfx/ic/canisters/Metrics/Metrics.did.js";
(global as any).fetch = fetch;

const agent = new HttpAgent({ host: "https://ic0.app" });
agent.fetchRootKey();
const actor = Actor.createActor<Metrics>(idlFactory, {
  agent,
  canisterId: "bsusq-diaaa-aaaah-qac5q-cai",
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

async function schedule() {
  const timestamp = new Date().toISOString();

  let attributes;
  try {
    attributes = await actor.allActiveAttributes();
  } catch (error) {
    console.error(error.message);
    return;
  }

  attributes.forEach(({ id, polling_frequency, status }) => {
    const active = "active" in status;

    if (polling_frequency[0]) {
      const freq = frequencyToCron(polling_frequency[0]!);
      if (tasks.has(id)) {
        const job = tasks.get(id)!;
        if (job[0] !== freq) {
          console.log(
            `[${timestamp}] [${id}] schedule changed from ${
              tasks.get(id)![0]
            } to ${freq}`
          );
          job[2].destroy();
        } else if (active && !job[1]) {
          console.log(`[${timestamp}] [${id}] now active, starting`);
          job[1] = active;
          job[2].start();
          tasks.set(id, job);
          return;
        } else {
          return;
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
                const job = tasks.get(id)!;
                job[1] = false;
                job[2].stop();
                tasks.set(id, job);
              } else if (result === "InvalidId") {
                result = `now deleted, destroying`;
                if (tasks.get(id)) {
                  const [_f, _a, task] = tasks.get(id)!;
                  task.stop();
                  tasks.delete(id);
                }
              }
            }
            console.log(`[${timestamp}] [${id}] execute: ${result}`);
          } catch (error) {
            console.log(`[${timestamp}] [${id}] execute: ${error.message}`);
          }
        }),
      ]);
    } else if (tasks.has(id)) {
      tasks.delete(id);
    }
  });
}

cron.schedule("* * * * *", schedule);

schedule();
