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

const getTotalFees = async (transactions) => {
  const totalFees = transactions.reduce(
    (sum, transaction) => sum + parseInt(transaction.fee_rate),
    0
  );
  return totalFees;
};

// The total costs reported for the block include the costs of the microblocks
// that it confirms, but those should actually count towards the budget of the
// previous block. This function will calculate the total costs of the current
// block, and also the total from the microblocks it confirms.
const getTotalCosts = async (transactions) => {
  let blockTxs = 0;
  let blockCosts = {
    read_count: 0,
    read_length: 0,
    runtime: 0,
    write_count: 0,
    write_length: 0,
  };
  let microblockTxs = 0;
  let microblockCosts = {
    read_count: 0,
    read_length: 0,
    runtime: 0,
    write_count: 0,
    write_length: 0,
  };
  for (const transaction of transactions) {
    // This tx is in the anchor block
    if (transaction.microblock_hash === "0x") {
      blockTxs++;
      const costs = getCosts(transaction);
      Object.keys(costs).forEach((key) => {
        blockCosts[key] += costs[key];
      });
    } else {
      microblockTxs++;
      const costs = getCosts(transaction);
      Object.keys(costs).forEach((key) => {
        microblockCosts[key] += costs[key];
      });
    }
  }
  return { blockTxs, blockCosts, microblockTxs, microblockCosts };
};

const fetchData = async (blockHeight) => {
  if (!blockHeight) {
    blockHeight = await getTipHeight();
  }
  const block = await getBlock(blockHeight);
  const transactions = await getAllTransactions(blockHeight);

  const { blockTxs, blockCosts, microblockTxs, microblockCosts } =
    await getTotalCosts(transactions);

  const blockPercentages = {};
  Object.keys(blockCosts).forEach((key) => {
    blockPercentages[key] = (blockCosts[key] / blockLimits[key]) * 100;
  });
  const microblockPercentages = {};
  Object.keys(microblockCosts).forEach((key) => {
    microblockPercentages[key] =
      (microblockCosts[key] / blockLimits[key]) * 100;
  });

  const totalFees = await getTotalFees(transactions);

  const highestCost = Math.max(...Object.values(blockPercentages));
  const feeRate = Math.round(totalFees / highestCost);

  return {
    block,
    blockTxs,
    microblockTxs,
    blockPercentages,
    microblockPercentages,
    totalFees,
    feeRate,
  };
};

const displayData = (data) => {
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
  document.getElementById("transactionCount").innerText = data.blockTxs;
  document.getElementById("totalFees").innerText = data.totalFees / 1000000;
  document.getElementById("averageFeeRate").innerText = data.feeRate;
  document.getElementById("microblockCount").innerText =
    data.block.microblocks_accepted.length;
  document.getElementById("microblockTxs").innerText = data.microblockTxs;

  // Costs
  document.getElementById("readCount").innerText =
    data.blockPercentages.read_count.toFixed(2);
  document.getElementById(
    "readCountBar"
  ).style.width = `${data.blockPercentages.read_count}%`;
  document.getElementById("readLength").innerText =
    data.blockPercentages.read_length.toFixed(2);
  document.getElementById(
    "readLengthBar"
  ).style.width = `${data.blockPercentages.read_length}%`;
  document.getElementById("writeCount").innerText =
    data.blockPercentages.write_count.toFixed(2);
  document.getElementById(
    "writeCountBar"
  ).style.width = `${data.blockPercentages.write_count}%`;
  document.getElementById("writeLength").innerText =
    data.blockPercentages.write_length.toFixed(2);
  document.getElementById(
    "writeLengthBar"
  ).style.width = `${data.blockPercentages.write_length}%`;
  document.getElementById("runtime").innerText =
    data.blockPercentages.runtime.toFixed(2);
  document.getElementById(
    "runtimeBar"
  ).style.width = `${data.blockPercentages.runtime}%`;

  // Microblock Costs
  document.getElementById("ublockReadCount").innerText =
    data.microblockPercentages.read_count.toFixed(2);
  document.getElementById(
    "ublockReadCountBar"
  ).style.width = `${data.microblockPercentages.read_count}%`;
  document.getElementById("ublockReadLength").innerText =
    data.microblockPercentages.read_length.toFixed(2);
  document.getElementById(
    "ublockReadLengthBar"
  ).style.width = `${data.microblockPercentages.read_length}%`;
  document.getElementById("ublockWriteCount").innerText =
    data.microblockPercentages.write_count.toFixed(2);
  document.getElementById(
    "ublockWriteCountBar"
  ).style.width = `${data.microblockPercentages.write_count}%`;
  document.getElementById("ublockWriteLength").innerText =
    data.microblockPercentages.write_length.toFixed(2);
  document.getElementById(
    "ublockWriteLengthBar"
  ).style.width = `${data.microblockPercentages.write_length}%`;
  document.getElementById("ublockRuntime").innerText =
    data.microblockPercentages.runtime.toFixed(2);
  document.getElementById(
    "ublockRuntimeBar"
  ).style.width = `${data.microblockPercentages.runtime}%`;

  // Links
  document.getElementById("prev-block").href = `/stacks-stats/block/?height=${
    data.block.height - 1
  }`;
  document.getElementById("next-block").href = `/stacks-stats/block/?height=${
    data.block.height + 1
  }`;
};

const toggleMicroblockSection = () => {
  var content = document.getElementById("microblock-info");

  if (content.style.display === "none") {
    content.style.display = "block";
    content.scrollIntoView({ behavior: "smooth" });
  } else {
    content.style.display = "none";
  }
};
