const blockLimits = {
  read_count: 15000,
  read_length: 100000000,
  runtime: 5000000000,
  write_count: 15000,
  write_length: 15000000,
};

const setBlockTime = (timestamp, blockTimeElement) => {
  const blockTime = dayjs.unix(timestamp);

  let now = dayjs();
  let hoursDifference = now.diff(blockTime, "hour");
  if (hoursDifference < 24) {
    blockTimeElement.textContent = blockTime.from(now);
    blockTimeElement.title = blockTime.format("MMM D, YYYY, h:mm:ss a");
  } else {
    blockTimeElement.textContent = blockTime.format("MMM D, YYYY, h:mm:ss a");
    blockTimeElement.title = ""; // clear the tooltip since it's not needed
  }
};

const getBlock = async (blockHeight) => {
  const url = `https://api.mainnet.hiro.so/extended/v1/block/by_height/${blockHeight}`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to retrieve data: ${response.statusText}`);
  const data = await response.json();
  return data;
};

const getCosts = (data) => {
  const costs = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("execution_cost_")) {
      const shortenedKey = key.replace("execution_cost_", "");
      costs[shortenedKey] = value;
    }
  }
  return costs;
};

const getTipHeight = async () => {
  const url = "https://api.mainnet.hiro.so/v2/info";
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to retrieve data: ${response.statusText}`);
  const data = await response.json();
  return data.stacks_tip_height;
};

const getAllTransactions = async (blockHeight) => {
  const url = `https://api.mainnet.hiro.so/extended/v1/tx/block_height/${blockHeight}`;
  const limit = 20; // This can be adjusted based on your needs
  let offset = 0;
  let allTransactions = [];

  while (true) {
    const response = await fetch(`${url}?offset=${offset}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to retrieve data: ${response.statusText}`);
    }

    const data = await response.json();
    allTransactions = allTransactions.concat(data.results);

    // Check if there are more pages
    if (offset + limit < data.total) {
      offset += limit;
    } else {
      break;
    }
  }

  return allTransactions;
};

const getTotalFees = async (blockHeight) => {
  const transactions = await getAllTransactions(blockHeight);
  const totalFees = transactions.reduce(
    (sum, transaction) => sum + parseInt(transaction.fee_rate),
    0
  );
  return totalFees;
};

const fetchData = async (blockHeight) => {
  if (!blockHeight) {
    blockHeight = await getTipHeight();
  }
  const block = await getBlock(blockHeight);

  const costs = getCosts(block);
  const percentages = {};
  Object.keys(costs).forEach((key) => {
    percentages[key] = (costs[key] / blockLimits[key]) * 100;
  });

  const totalFees = await getTotalFees(blockHeight);

  const highestCost = Math.max(...Object.values(percentages));
  const feeRate = Math.round(totalFees / highestCost);

  return {
    block,
    percentages,
    totalFees,
    feeRate,
  };
};

function displayData(data) {
  // Block Heights
  document.getElementById("stacksBlockHeight").innerText = data.block.height;
  document.getElementById(
    "stacksExplorerLink"
  ).href = `https://explorer.hiro.so/block/${data.block.hash}?chain=mainnet`;
  document.getElementById("bitcoinBlockHeight").innerText =
    data.block.burn_block_height;
  document.getElementById(
    "bitcoinExplorerLink"
  ).href = `https://mempool.space/block/${data.block.burn_block_height}`;

  // Block Time
  setBlockTime(
    data.block.burn_block_time,
    document.getElementById("blockTime")
  );

  // Block Info
  document.getElementById("transactionCount").innerText = data.block.txs.length;
  document.getElementById("totalFees").innerText = data.totalFees / 1000000;
  document.getElementById("averageFeeRate").innerText = data.feeRate;

  // Costs
  document.getElementById("readCount").innerText =
    data.percentages.read_count.toFixed(2);
  document.getElementById(
    "readCountBar"
  ).style.width = `${data.percentages.read_count}%`;
  document.getElementById("readLength").innerText =
    data.percentages.read_length.toFixed(2);
  document.getElementById(
    "readLengthBar"
  ).style.width = `${data.percentages.read_length}%`;
  document.getElementById("writeCount").innerText =
    data.percentages.write_count.toFixed(2);
  document.getElementById(
    "writeCountBar"
  ).style.width = `${data.percentages.write_count}%`;
  document.getElementById("writeLength").innerText =
    data.percentages.write_length.toFixed(2);
  document.getElementById(
    "writeLengthBar"
  ).style.width = `${data.percentages.write_length}%`;
  document.getElementById("runtime").innerText =
    data.percentages.runtime.toFixed(2);
  document.getElementById(
    "runtimeBar"
  ).style.width = `${data.percentages.runtime}%`;

  // Links
  document.getElementById("prev-block").href = `/stacks-stats/block/?height=${
    data.block.height - 1
  }`;
  document.getElementById("next-block").href = `/stacks-stats/block/?height=${
    data.block.height + 1
  }`;
}
