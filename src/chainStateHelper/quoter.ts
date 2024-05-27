import { createPublicClient, encodePacked, http,parseEther,PublicClient } from "viem";
import Web3, { HttpProvider } from "web3";
import { uniV3QuoterV2ABI } from "./abi/univ3Quoter02";
import { mainnet } from "viem/chains";
import { uniswapV2Router02ABI } from "./abi/univ2Router02";
import { ERIGON_URL } from "../config";
import {readFileSync,writeFileSync} from 'fs';
import { replacer } from "../utils/utils";
import { MongoDBHelper } from "../mongoDBHelper/mongoDBHelper";

// V2 Router Address
const UniswapV2Router02Address =
	'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UniswapV3QuoterV2Address =
	'0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const USDC = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const v3_weth_usdt_500 = '0x11b815efb8f581194ae79006d24e0d814b7697f6';
const v3_weth_usdt_3000 = '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36'

let map:Record<string,string> = {
    "0x11b815efb8f581194ae79006d24e0d814b7697f6":'v3_weth_usdt_500',
    "0x4e68ccd3e89f51c3074ca5072bbac773960dfa36":'v3_weth_usdt_3000'
}



let a_set = new Set();
a_set.add(WETH);
a_set.add(USDT);

const USDT_deimal = 1000000
type UniV3QuoteArgs = {
    isZeroForOne: boolean;
    amountIn: bigint;
    token0: string;
    token1: string;
    fee: bigint;
}

type UniV2QuoteArgs = {
    isZeroForOne: boolean;
    amountIn: bigint;
    token0: string,
    token1: string
}


class Quoter {
    myWeb3 : Web3
	publicClient: PublicClient;
    constructor(nodeurl: string){
        this.myWeb3 = new Web3(new HttpProvider(nodeurl));
        this.publicClient = createPublicClient({
			chain: mainnet,
			transport: http(nodeurl),
		});
    }

    public async quoteWETH_USDT(
        isE2U:boolean,
        amountIn: bigint,
        blockNumber?: bigint
    ){
        let res:any = {};
        let isZeroForOne = isE2U
        let v3FeeList = [
            500n,
            3000n,
        ]        
        let v2Out = await this.V2Quote({
            isZeroForOne,
            amountIn,
            token0: WETH,
            token1: USDT
        },blockNumber);
        if(v2Out){
            res['v2Out'] = Number(v2Out)
        }


        for(const fee of v3FeeList){
            let v3Out = await this.V3Quote({
                isZeroForOne,
                amountIn,
                token0: WETH,
                token1: USDT,
                fee
            },blockNumber)
            if(v3Out){
                res[`v3Out_${fee}`] = Number(BigInt(v3Out)) 
            }

        }
        return res;
    }

    public async V2Quote(args: UniV2QuoteArgs, blockNumber?:bigint){
        let token_list: any[] = [];
		let amountsOut = 0n;
		// prepare args to call router
		if (args.isZeroForOne) {
			token_list = [args.token0, args.token1];
		} else {
			token_list = [args.token1, args.token0];
		}
        try{
            let amount_list = (await this.publicClient.readContract({
                address: UniswapV2Router02Address,
                abi: uniswapV2Router02ABI,
                functionName: 'getAmountsOut',
                args: [args.amountIn, token_list],
                blockNumber: blockNumber,
            })) as bigint[];
            amountsOut = amount_list[1];
            return amountsOut
        }catch(error){
            console.log('Fail to quote v2 price',args.token0,args.token1);
        }
    }


    // return sqrtPriceX96
    // public async V3SpotPrice(args: UniV3QuoteArgs, blockNumber?:bigint){
    //     let v3pool = 

    //     try{

    //     }
    // }

    // return quote out
    public async V3Quote(args: UniV3QuoteArgs, blockNumber?: bigint){
        let path = this.encodePath(
			args.isZeroForOne,
			args.token0,
			args.token1,
			Number(args.fee)
		);
        try{
            let quoteContract = new this.myWeb3.eth.Contract(
                uniV3QuoterV2ABI,
                UniswapV3QuoterV2Address
            );
            let res = await quoteContract.methods
                .quoteExactInput(path, args.amountIn)
                .call(undefined, blockNumber);
            return res.amountOut;
        }catch(error){
            console.log('Fail to quote v3 price',args.token0,args.token1,args.fee);
        }
    }


    private encodePath(
		isZeroForOne: boolean,
		token0: string,
		token1: string,
		fee: number
	) {
		let type_list = ['address', 'uint24', 'address'];
		let token_fee_list: any[] = [];
		if (isZeroForOne) {
			token_fee_list = [token0, fee, token1];
		} else {
			token_fee_list = [token1, fee, token0];
		}
		const path = encodePacked(type_list, token_fee_list);
		return path;
	}
}
function replaceETH(assetAddress:string){
    if(assetAddress == "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"){
        return "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    }else{
        return assetAddress
    }
     
}


async function main(){
    let quoter = new Quoter(ERIGON_URL);
    let mongoHelper = new MongoDBHelper();
    await mongoHelper.connect();

    let number = parseEther('1');
    let meta = readFileSync('./data/orderHashMap.json');
    let data = JSON.parse(meta.toString())

    let newOrders:any[] = []
    for(let [index,order] of data.entries()){
        console.log(`${index}/${data.length}`)
        let takerAsset = replaceETH(order.takerAsset)
        let makerAsset = replaceETH(order.makerAsset)

        if(
            (takerAsset == USDT && makerAsset == WETH)|| 
            (takerAsset == WETH && makerAsset == USDT)
        ){

            let execution_price = 0;
            let orderType = 'sell_eth'
            let oneETH = parseEther('1')
            for(let event of order.events){
                let trx = await mongoHelper.loadTargetTrx(event.trxHash);
                // console.log(trx);
                let mergedProfitMap = trx.mergedProfitMap

                let realAmountOut = Number(event.takerAmount);

                let isE2U = false;
                if(takerAsset == USDT && makerAsset == WETH){
                    execution_price = Number(oneETH * BigInt(event.takerAmount) / BigInt(event.makerAmount)) / USDT_deimal
                    isE2U = true
                }else{
                    execution_price = Number(oneETH * BigInt(event.makerAmount) / BigInt(event.takerAmount)) / USDT_deimal
                    orderType = 'buy_eth'
                }

                let OutMap = await quoter.quoteWETH_USDT(
                    isE2U,
                    event.makerAmount,
                    BigInt(event.blockNumber)-1n
                );
                let priceMap:any = {}
                let optimalOut = 0

                for(const key in OutMap){
                    let price = 0
                    let out = OutMap[key]
                    if(out > optimalOut){
                        optimalOut = out
                    }
                    if(takerAsset == USDT && makerAsset == WETH){
                        price = Number(oneETH * BigInt(OutMap[key]) / BigInt(event.makerAmount)) / USDT_deimal
                    }else{
                        price = Number(oneETH * BigInt(event.makerAmount) / BigInt(OutMap[key])) / USDT_deimal
                    }
                    priceMap[key] = price
                }

                // console.log(priceMap);
                event.profitAllPositive = trx.profitAllPositive;
                event.swapEvents = trx.swapEvents;
                event.realAmountOut = realAmountOut;
                event.optimalOut = optimalOut;
                event.OutMap = OutMap;
                event.priceMap = priceMap
                event.execution_price = execution_price
                event.orderType = orderType
                event.mergedProfitMap = mergedProfitMap
            }
            // console.log(order)
            // break
            newOrders.push(order);
        }
    }

    writeFileSync('./data/usdt_order_res.json',JSON.stringify(newOrders,replacer));
    // console.log(out);
    mongoHelper.close();

}

main();