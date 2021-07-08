import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import {
  idlFactory as metrics_idl,
  canisterId as metrics_id,
} from "dfx-generated/Metrics";

const agent = new HttpAgent({ host: "http://127.0.0.1:8000" });
agent.fetchRootKey();
const metrics = Actor.createActor(metrics_idl, {
  agent,
  canisterId: metrics_id,
});

const stringify = (data) =>
  JSON.stringify(
    data,
    (key, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value instanceof Principal
        ? value.toText()
        : Buffer.isBuffer(value)
        ? value.toString("hex")
        : value,
    2
  );

const get = async () => {
  document.getElementById("output").innerText = "Loading...";

  const period = document.getElementById("period").value;
  console.log({ period });

  const attributes = await metrics.allActiveAttributes();
  console.log({ attributes });
  const results = await Promise.all(
    attributes.map(({ id }) =>
      metrics.recordById({
        attributeId: id,
        before: [],
        limit: [50],
        period: period ? [{ [period]: null }] : [],
      })
    )
  );
  const output = results.map((res) => {
    if (res.err) return res.err;
    const out = res.ok;
    return `
id: ${out.id}
status: ${Object.keys(out.status)[0]}
principal: ${out.principal}
name: ${out.description.name}
description: ${out.description.description[0] || ""}
polling_frequency: ${
      out.description.polling_frequency[0]
        ? `${out.description.polling_frequency[0].n} ${
            Object.keys(out.description.polling_frequency[0].period)[0]
          }`
        : ""
    }
getter: ${out.description.getter.join(".")}
series:
${out.series
  .map(({ value, timestamp }) =>
    [new Date(Number(timestamp / BigInt(1e6))).toISOString(), value].join(" ")
  )
  .join("\n")}
    `;
  });
  console.log({ results });

  document.getElementById("output").innerText = output;
};

document.getElementById("clickMeBtn").addEventListener("click", get);

get();
