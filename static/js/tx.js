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

const fetchData = async (txid) => {
  if (!txid) {
    txid = await getLatestTxid();
  }
  const tx = await getTx(txid);

  return tx;
};

const displayData = (data) => {
  console.log(data);
};
