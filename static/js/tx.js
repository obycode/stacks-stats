const setBlockTime = (confirmed, timestamp, blockTimeElement) => {
  const blockTime = dayjs.unix(timestamp);
  let prefix = "";
  if (confirmed) {
    prefix = "Confirmed ";
  } else {
    prefix = "Received ";
  }

  let now = dayjs();
  let hoursDifference = now.diff(blockTime, "hour");
  if (hoursDifference < 24) {
    blockTimeElement.textContent = prefix + blockTime.from(now);
    blockTimeElement.title =
      prefix + blockTime.format("MMM D, YYYY, h:mm:ss a");
  } else {
    blockTimeElement.textContent =
      prefix + blockTime.format("MMM D, YYYY, h:mm:ss a");
    blockTimeElement.title = ""; // clear the tooltip since it's not needed
  }
};

const getLatestTxid = async () => {
  const url = "https://api.mainnet.hiro.so/extended/v1/tx?limit=1";
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to retrieve data: ${response.statusText}`);
  const data = await response.json();
  return data.results[0].tx_id;
};

const getTx = async (txid) => {
  const url = `https://api.mainnet.hiro.so/extended/v1/tx/${txid}`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to retrieve data: ${response.statusText}`);
  const data = await response.json();
  return data;
};

const truncateTxId = (txid) => {
  const start = txid.substring(0, 10); // Take the first 6 characters
  const end = txid.substring(txid.length - 8); // Take the last 6 characters
  return `${start}...${end}`;
};

const getNonces = async (address) => {
  const url = `https://api.mainnet.hiro.so/extended/v1/address/${address}/nonces`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to retrieve data: ${response.statusText}`);
  const data = await response.json();
  return data;
};

const showNonceDialog = (kind, text) => {
  if (kind !== "error") {
    document.getElementById("nonce-error").style.display = "none";
  } else if (kind !== "warning") {
    document.getElementById("nonce-warning").style.display = "none";
  } else if (kind !== "info") {
    document.getElementById("nonce-info").style.display = "none";
  }

  document.getElementById(`nonce-${kind}-text`).textContent = text;
  document.getElementById(`nonce-${kind}`).style.display = "block";
};

const hideNonceDialogs = () => {
  document.getElementById("nonce-error").style.display = "none";
  document.getElementById("nonce-warning").style.display = "none";
  document.getElementById("nonce-info").style.display = "none";
};

const displayNonceInfo = async (data) => {
  let sender_nonces = await getNonces(data.sender_address);
  document.getElementById("nonce").textContent = data.nonce;

  if (
    !data.burn_block_time &&
    sender_nonces.last_executed_tx_nonce >= data.nonce
  ) {
    showNonceDialog(
      "error",
      `This transaction cannot be executed. Nonce ${data.nonce} has already been confirmed.`
    );
  } else if (
    !data.burn_block_time &&
    sender_nonces.detected_missing_nonces.length > 0
  ) {
    showNonceDialog(
      "warning",
      `Missing nonces detected: ${sender_nonces.detected_missing_nonces.sort().join(
        ", "
      )}`
    );
  } else if (
    !data.burn_block_time &&
    sender_nonces.detected_mempool_nonces.length > 0
  ) {
    let waitingForNonces = "";
    if (sender_nonces.last_executed_tx_nonce + 1 === data.nonce) {
      hideNonceDialogs();
    } else {
      waitingForNonces = `Waiting for ${
        sender_nonces.last_executed_tx_nonce + 1
      }`;
      if (sender_nonces.last_executed_tx_nonce + 1 < data.nonce - 1) {
        waitingForNonces += `...${data.nonce - 1}`;
      }

      showNonceDialog("info", waitingForNonces);
    }
  } else {
    hideNonceDialogs();
  }
};

const fetchData = async (txid) => {
  if (!txid) {
    txid = await getLatestTxid();
  }
  const tx = await getTx(txid);

  return tx;
};

const displayData = async (data) => {
  document.getElementById("txid").textContent = truncateTxId(data.tx_id);
  document.getElementById(
    "explorer-link"
  ).href = `https://explorer.hiro.so/txid/${data.tx_id}`;
  document.getElementById("block").textContent = data.block_height || "Pending";
  document.getElementById("sender").textContent = data.sender_address;

  await displayNonceInfo(data);

  // Block Time
  if (data.burn_block_time) {
    setBlockTime(
      true,
      data.burn_block_time,
      document.getElementById("blockTime")
    );
  } else {
    setBlockTime(
      false,
      data.receipt_time,
      document.getElementById("blockTime")
    );
  }
};
