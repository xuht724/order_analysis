// "https://eth-mainnet.g.alchemy.com/v2/AmGhouGifK4fNQtvtdZI_wQX1pdgHxQo"
// "https://mainnet.infura.io/v3/d562ab8be7824445a11dc8c7575552cd"
// "https://eth-mainnet.nodereal.io/v1/abf58db7a57847518733df4dd817bbbc"
// "https://sparkling-divine-tree.discover.quiknode.pro/614a2336889d86c106f4c654f769bfe26f833fe3/"
import * as dotenv from "dotenv";
const info = dotenv.config({ path: '/home/os/haotian/arb_monitor/.env' });

export const HTTP_NODE_URL = info.parsed!.NODESERVICE
export const sqlite_database = info.parsed!.SQLITEDATABASE;
export const mongodb_url = info.parsed!.MONGODB;

export const ERIGON_URL = 'http://127.0.0.1:8547';
export const IPC_NODE_URL = '/home/os/ethereum/execution/data/geth.ipc'

export const failedBlockNumberPath = "src/failedBlockNumber.txt";
export const alchemy_url = "https://eth-mainnet.g.alchemy.com/v2/AmGhouGifK4fNQtvtdZI_wQX1pdgHxQo";