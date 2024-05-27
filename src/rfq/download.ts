import { createPublicClient, decodeFunctionData, http, parseAbiItem } from "viem";
import { OneInchV6RouterABI } from "../abi/oneInchV6";
import { ChainStateHelper } from "../chainStateHelper/chainStateHelper";
import { ERIGON_URL, alchemy_url, mongodb_url } from "../config";
import Web3, { Contract, Filter, HttpProvider } from "web3";
import { ErigonHelper } from "../erigonHelper/erigonHelper";
import { mainnet } from "viem/chains";
import { MongoDBHelper } from "../mongoDBHelper/mongoDBHelper";

const oneinchV6RouterAddress = '0x111111125421ca6dc452d289314280a0f8842a65';
const orderFilledSig = '0xfec331350fce78ba658e082a71da20ac9f8d798a99b3c79681c8440cbfe77e07';

const begin = 19937213n
const end = 19944362n
const batch = 100n

let web3 = new Web3(new HttpProvider(ERIGON_URL));
let publicClient = createPublicClient({
    chain: mainnet,
    transport: http(ERIGON_URL)
})
const fsmap = {
    fillContractOrder: '0xcc713a04',
    fillContractOrderArgs: '0x56a75868',
    fillOrder: '0x9fda64bd',
    fillOrderArgs: '0xf497df75'
}




const orderFilledAbiItem = {
    "anonymous": false,
    "inputs": [
        {
            "indexed": false,
            "internalType": "bytes32",
            "name": "orderHash",
            "type": "bytes32"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "remainingAmount",
            "type": "uint256"
        }
    ],
    "name": "OrderFilled",
    "type": "event"
}

function decodeTrace(trace: any): any[] {
    let events: any[] = []

    // 检查 trace 对象的目标地址
    if (trace.to === oneinchV6RouterAddress) {
        let res = decodeInput(trace.input);
        // console.log(res);
        if (res) {
            events.push(convertBigIntToHex(res));
            }
    }
    // 检查 trace 对象的 calls 属性
    if (!trace.calls) return events;
    for (let call of trace.calls) {
    let temp = decodeTrace(call);
    if (temp && temp.length > 0) {
        events = events.concat(temp);
    }
    }
    return events;
}
function decodeInput(data: string): any | null {
    if (data === '0x') {
        return null;
    } else {
        const value = decodeFunctionData({
            abi: OneInchV6RouterABI,
            data: data as any
        })
        return value
    }
}

function convertBigIntToHex(obj: any): any {
    if (typeof obj === 'bigint') {
        return web3.utils.toHex(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => convertBigIntToHex(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = convertBigIntToHex(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
let erigonHelper = new ErigonHelper(ERIGON_URL)

async function analyseOrder(
    erigonHelper: ErigonHelper,
    trxHash: string
) {
    let trace = await erigonHelper.getTransactionTrace(trxHash);
    let orderInfoList = decodeTrace(trace);
    console.log(orderInfoList)

}

// analyseOrder(
//     erigonHelper,
//     '0x2e3989ed2ffca894fae9a90ef9b76dbf2fbbbf51881d2608680f6d6a017a61db'
// );

async function main() {
    let chainStateHelper = new ChainStateHelper(ERIGON_URL);
    let mongoHelper = new MongoDBHelper()
    await mongoHelper.connect();

    for (let i = begin; i < end; i += batch) {
        let tempBegin = i;
        let tempEnd = (i + batch) > end ? end : i + batch;
        console.log(tempEnd-begin, '/', end - begin);

        const filter: Filter = {
            fromBlock: tempBegin,
            toBlock: tempEnd,
            address: oneinchV6RouterAddress,
            topics: [orderFilledSig]
        };

        const logs = await web3.eth.getPastLogs(filter);
        for (const log of logs) {
            let trxHash = (log as any).transactionHash;
            // console.log(trxHash);
            let trace = await erigonHelper.getTransactionTrace(trxHash);
            let trx = await web3.eth.getTransaction(trxHash);
            let receipt = await web3.eth.getTransactionReceipt(trxHash);
            // console.log(trx);
            let orderInfoList = decodeTrace(trace);
            let storedData: any = {
                transactionHash: trxHash,
                from: trx.from,
                to: trx.to,
                nonce: trx.nonce,
                blockNumber: trx.blockNumber,
                maxPriorityFeePerGas: trx.maxPriorityFeePerGas,
                maxFeePerGas: trx.maxFeePerGas,
                input: trx.input,
                transactionIndex: trx.transactionIndex,
                gas: trx.gas,
                hash: trx.hash,
                orderInfoList: orderInfoList,
                receipt: receipt
            }
            await mongoHelper.writeV6OrderTrx(storedData);
        }
    }

    mongoHelper.close();

    // console.log(web3.utils.toHex(0n))

}

main()