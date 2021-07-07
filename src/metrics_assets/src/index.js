import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as metrics_idl, canisterId as metrics_id } from 'dfx-generated/metrics';

const agent = new HttpAgent();
const metrics = Actor.createActor(metrics_idl, { agent, canisterId: metrics_id });

document.getElementById("clickMeBtn").addEventListener("click", async () => {
  const name = document.getElementById("name").value.toString();
  const greeting = await metrics.greet(name);

  document.getElementById("greeting").innerText = greeting;
});
