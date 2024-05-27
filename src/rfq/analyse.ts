import { Address, formatEther, formatUnits, maxUint64, parseUnits } from "viem";
import { ChainStateHelper } from "../chainStateHelper/chainStateHelper";
import { ERIGON_URL } from "../config";
import { MongoDBHelper } from "../mongoDBHelper/mongoDBHelper"
import { writeFileSync } from 'fs'
import Web3, { HttpProvider } from "web3";
import { uniswapV2Router02ABI } from "../abi/dex/uniswapLike/uniswapV2/uniV2Router02";

let web3 = new Web3(new HttpProvider(ERIGON_URL));

const UniswapV2RouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
const fsmap = {
    fillContractOrder: '0xcc713a04',
    fillContractOrderArgs: '0x56a75868',
    fillOrder: '0x9fda64bd',
    fillOrderArgs: '0xf497df75'
} as const
function analyseOrderArgs(fn: string, args: any) {
    switch (fn) {
        case 'fillOrder':
            {
                let order = args[0];
                let amount = args[3];
                return { order, amount }
            }
        case 'fillOrderArgs':
            {
                let order = args[0];
                let amount = args[3];
                return { order, amount }
            }
        case 'fillContractOrder':
            {
                let order = args[0];
                let amount = args[2];
                return { order, amount }
            }
        case 'fillContractOrderArgs':
            {
                let order = args[0];
                let amount = args[2];
                return { order, amount }
            }
        default:
            return { order: null, amount: null }
    }
}

const usdt = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const ondo = '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3';

async function calculateOrderWETHVolume(
    order:any,
    amount: bigint,
    blockNumber: bigint
){
    let list = calculateVolume(order,amount);
    if(list.length == 1){
        return list[0].volume
    }else{
        let out = maxUint64
        for(const res of list){
            // console.log('token',res.token, 'volume', res.volume)
            let newOut = await quoteV2WETHVolume(
                res.token,
                res.volume,
                blockNumber
            )
            if(out > newOut && newOut!=0n){
                out = newOut
                console.log('token',res.token,'out',formatEther(out));
            }else{
                // console.log('token',res.token,'newOut',newOut);

            }
            }
        // console.log('final out',out);
        return out;
    }
}

async function quoteV2WETHVolume(
    token: string,
    volume: bigint,
    blockNumber: bigint
):Promise<bigint>{
    let router = new web3.eth.Contract(
        uniswapV2Router02ABI,
        UniswapV2RouterAddress
    )
    try{
        let res = await router.methods.getAmountsOut(volume, [token,weth]).call(undefined,blockNumber) as bigint[]
        return res[1];
    }catch(error){
        return 0n;
    }
}

function calculateVolume(
    order: any,
    amount: bigint
) {
    let ma = order.makerAsset;
    let ta = order.takerAsset;
    let isMaking = isMakingAmount(order.makerTraits);
    let mAa = BigInt(order.makingAmount);
    let tAa = BigInt(order.takingAmount);
    let volume = 0n
    if (ma == weth || ta == weth) {
        if (isMaking) {
            // input is making amount
            if (ma == weth) {
                if (amount > mAa) {
                    volume = mAa
                }else{
                    volume = amount
                }
            } else {
                let n = amount * tAa / mAa;
                if (n > mAa) {
                    volume = mAa
                }else{
                    volume = n;
                }
            }
        } else {
            // input is taking
            if (ta == weth) {
                if (amount > tAa) {
                    volume = tAa
                }else{
                    volume = amount
                }
            } else {
                let n = amount * mAa / tAa;
                if (n > tAa) {
                    volume = tAa
                }else{
                    volume = n;
                }
            }
        }
        return [{
            token: weth,
            volume
        }]
    }else{
        let maVolume = 0n
        let taVolume = 0n
        if (isMaking){
            if (amount > mAa) {
                maVolume = mAa
                taVolume = tAa
            }else{
                maVolume = amount
                taVolume = amount * tAa / mAa;
            }
        }else{
            if (amount > tAa) {
                maVolume = mAa
                taVolume = tAa
            }else{
                maVolume = amount * mAa / tAa
                taVolume = amount;
            }
        }

        return [{
            token: ma,
            volume:maVolume,
        },
        {
            token: ta,
            volume: taVolume
        }
    ]
    }
}

function calculateTokenVolume(
    trxHash: string,
    order: any,
    amount: bigint,
    token: string) {
    let ma = order.makerAsset;
    let ta = order.takerAsset;
    let isMaking = isMakingAmount(order.makerTraits);
    let mAa = BigInt(order.makingAmount);
    let tAa = BigInt(order.takingAmount);
    if (ma == token || ta == token) {
        if (isMaking) {
            // input is making amount
            if (ma == token) {
                if (amount > mAa) {
                    return mAa
                }

                return amount
            } else {
                let n = amount * tAa / mAa;
                if (n > mAa) {
                    return mAa
                }
                // console.log(trxHash)
                // console.log(amount,tAa,mAa);
                // console.log(order,formatUnits(n,6))

                return n;
            }
        } else {
            // input is taking
            if (ta == token) {
                if (amount > tAa) {
                    return tAa
                }

                return amount
            } else {
                let n = amount * mAa / tAa;
                if (n > tAa) {
                    return tAa
                }
                // console.log(trxHash)
                // console.log(amount,tAa,mAa);
                // console.log(order,formatUnits(n,6))

                return n;
            }
        }
    } else {
        return 0n
    }
}


export function isMakingAmount(traits: string) {
    const flag = 1n << 255n;
    let isMaking = BigInt(traits) & flag;
    return isMaking
}

async function analyseTradingVolume(
    volumeMap: Map<string, bigint>,
    csHelper: ChainStateHelper,
    decimal: number
) {
    let trading_volume_list: any[] = []

    for (const [pair, value] of volumeMap) {
        let [token0, token1] = pair.split('_');
        let token0Symbol = await csHelper.getToken(token0);
        let token1Symbol = await csHelper.getToken(token1);
        // console.log(pair, value);
        trading_volume_list.push({
            token0: token0Symbol,
            token1: token1Symbol,
            amount: formatUnits(value, decimal),
        })
    }
    trading_volume_list.sort((a, b) => {
        return Number(b.amount) - Number(a.amount)
    })
    return trading_volume_list
}

function formatAddr(addr: string): string {
    let addrWithoutPrefix = addr.slice(2);
    // console.log(addrWithoutPrefix.length);
    // 计算需要添加多少个'0'以使长度达到40
    let zerosNeeded = 40 - addrWithoutPrefix.length;

    // 生成相应的'0'字符串并添加到addrWithoutPrefix的前面
    let prefixZeros = '0'.repeat(zerosNeeded);

    // 返回补零后的地址
    return '0x' + prefixZeros + addrWithoutPrefix;
}

async function analyseAllTrx() {
    let mongoHelper = new MongoDBHelper();
    await mongoHelper.connect();
    let res = await mongoHelper.db.collection('v6OrderTrx').find().toArray();
    let fnSet: Set<string> = new Set<string>();
    let fnMap: Map<string, number> = new Map<string, number>();
    let tradingWETHVolume: Map<string, bigint> = new Map();
    let pairMap: Map<string, number> = new Map<string, number>();
    let chainStateHelper = new ChainStateHelper(ERIGON_URL);

    // console.log(res.length);

    for (const [i,trx] of res.entries()) {
        console.log(`${i}/${res.length}`);

        let orderInfoList = trx.orderInfoList;
        for (const orderInfo of orderInfoList) {
            let fn = orderInfo.functionName as string;
            let args = orderInfo.args;
            let { order, amount } = analyseOrderArgs(fn, args);

            if (order && amount) {
                // console.log(fn);
                let amountn = BigInt(amount);
                let token0 = formatAddr(order.makerAsset.toLowerCase());
                let token1 = formatAddr(order.takerAsset.toLowerCase());
                if (token0 > token1) {
                    token0 = formatAddr(order.takerAsset.toLowerCase());
                    token1 = formatAddr(order.makerAsset.toLowerCase());
                }
                let pair = `${token0}_${token1}`;
                
                // console.log('trxHash', trx.transactionHash);
                let weth_volume = await calculateOrderWETHVolume(
                    order, amountn, 
                    trx.blockNumber 
                );
                if(token0 == usdt && token1 == ondo){
                    console.log(order)
                    console.log(amountn);
                }

                if (pairMap.has(pair)) {
                    pairMap.set(pair, pairMap.get(pair)! + 1)
                } else {
                    pairMap.set(pair, 1);
                }
                if (tradingWETHVolume.has(pair)) {
                    tradingWETHVolume.set(pair, tradingWETHVolume.get(pair)! + weth_volume)
                } else {
                    tradingWETHVolume.set(pair, weth_volume);
                }

            }

        }
    }

    const filteredTradingWETHVolume = new Map(
        Array.from(tradingWETHVolume.entries()).filter(([_, value]) => value !== 0n)
    );

    writeFileSync('./weth_volume.json', JSON.stringify(await analyseTradingVolume(filteredTradingWETHVolume, chainStateHelper, 18)));

    mongoHelper.close();
}

analyseAllTrx();

async function main() {
    let mongoHelper = new MongoDBHelper();
    await mongoHelper.connect();
    let res = await mongoHelper.db.collection('v6OrderTrx').find().toArray();
    let fnSet: Set<string> = new Set<string>();
    let fnMap: Map<string, number> = new Map<string, number>();
    let tradingUSDTVolume: Map<string, bigint> = new Map();
    let tradingWETHVolume: Map<string, bigint> = new Map();
    let pairMap: Map<string, number> = new Map<string, number>();
    let chainStateHelper = new ChainStateHelper(ERIGON_URL);


    let usdt_order_num = 0
    let weth_order_num = 0
    let usdt_weth_order_num = 0

    // console.log(res.length);

    for (const trx of res) {
        let orderInfoList = trx.orderInfoList;
        for (const orderInfo of orderInfoList) {
            let fn = orderInfo.functionName as string;
            let args = orderInfo.args;
            let { order, amount } = analyseOrderArgs(fn, args);

            if (order && amount) {
                // console.log(fn);
                let amountn = BigInt(amount);
                let token0 = formatAddr(order.makerAsset.toLowerCase());
                let token1 = formatAddr(order.takerAsset.toLowerCase());
                if (token0 > token1) {
                    token0 = formatAddr(order.takerAsset.toLowerCase());
                    token1 = formatAddr(order.makerAsset.toLowerCase());
                }
                let pair = `${token0}_${token1}`;

                let usdt_volume = calculateTokenVolume(trx.transactionHash, order, amountn, usdt);
                let weth_volume = calculateTokenVolume(trx.transactionHash, order, amountn, weth);

                if (usdt_volume != 0n) {
                    usdt_order_num += 1;
                }
                if (weth_volume != 0n) {
                    weth_order_num += 1;
                }
                if (token0 == weth && token1 == usdt) {
                    usdt_weth_order_num += 1
                }

                if (pairMap.has(pair)) {
                    pairMap.set(pair, pairMap.get(pair)! + 1)
                } else {
                    pairMap.set(pair, 1);
                }

                if (tradingUSDTVolume.has(pair)) {
                    tradingUSDTVolume.set(pair, tradingUSDTVolume.get(pair)! + usdt_volume)
                } else {
                    tradingUSDTVolume.set(pair, usdt_volume);
                }

                if (tradingWETHVolume.has(pair)) {
                    tradingWETHVolume.set(pair, tradingWETHVolume.get(pair)! + weth_volume)
                } else {
                    tradingWETHVolume.set(pair, weth_volume);
                }

            }

        }
    }

    const filteredTradingUSDTVolume = new Map(
        Array.from(tradingUSDTVolume.entries()).filter(([_, value]) => value !== 0n)
    );
    const filteredTradingWETHVolume = new Map(
        Array.from(tradingWETHVolume.entries()).filter(([_, value]) => value !== 0n)
    );

    // console.log(tradingWETHVolume);

    writeFileSync('./usdt_volume.json', JSON.stringify(await analyseTradingVolume(filteredTradingUSDTVolume, chainStateHelper, 6)))
    writeFileSync('./weth_volume.json', JSON.stringify(await analyseTradingVolume(filteredTradingWETHVolume, chainStateHelper, 18)));

    // console.log(pairMap);
    console.log(usdt_order_num);
    console.log(weth_order_num);
    console.log(usdt_weth_order_num);
    mongoHelper.close();
}

// main();