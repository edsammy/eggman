import { createWalletClient, createPublicClient, http, parseAbi, decodeEventLog } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

export interface MintResult {
    transactionHash?: string
    error?: string
}

export interface MintConfig {
    contractAddress: `0x${string}`
    privateKey: `0x${string}`
    rpcUrl?: string
}

const NFT_ABI = parseAbi([
    'function mint(address to) public returns (uint256)',
    'event TokenMinted(uint256 indexed tokenId, address indexed to)'
])

export async function mintNFT(recipientAddress: `0x${string}`, config: MintConfig): Promise<MintResult> {
    try {
        console.log(`🚀 Minting NFT on Base Sepolia`)

        const account = privateKeyToAccount(config.privateKey)
        
        const walletClient = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http(config.rpcUrl)
        })

        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(config.rpcUrl)
        })

        console.log(`📝 Minting with account: ${account.address}`)
        console.log(`📍 Contract address: ${config.contractAddress}`)
        console.log(`🎨 Minting NFT to: ${recipientAddress}`)

        const { request } = await publicClient.simulateContract({
            address: config.contractAddress,
            abi: NFT_ABI,
            functionName: 'mint',
            args: [recipientAddress],
            account
        })

        const hash = await walletClient.writeContract(request)
        console.log(`⏳ Transaction hash: ${hash}`)
        console.log(`✅ Successfully submitted mint transaction`)

        return {
            transactionHash: hash
        }
    } catch (error) {
        console.error('❌ Mint error:', error)
        return {
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

async function main() {
    const config: MintConfig = {
        contractAddress: '0xE6DF4dD9a2ad8b0DC780f999C6D727383E180Fd3',
        privateKey: process.env.PRIVATE_KEY as `0x${string}` || '0x0000000000000000000000000000000000000000000000000000000000000000',
        rpcUrl: process.env.RPC_URL_BASE_CHAIN
    }

    const recipientAddress = process.env.RECIPIENT_ADDRESS as `0x${string}` || config.privateKey && privateKeyToAccount(config.privateKey).address

    if (!config.contractAddress || config.contractAddress === '0x0000000000000000000000000000000000000000') {
        console.error('❌ CONTRACT_ADDRESS environment variable is required')
        process.exit(1)
    }

    if (!config.privateKey || config.privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.error('❌ PRIVATE_KEY environment variable is required')
        process.exit(1)
    }

    if (!recipientAddress) {
        console.error('❌ RECIPIENT_ADDRESS environment variable is required')
        process.exit(1)
    }

    const result = await mintNFT(recipientAddress, config)
    
    if (result.transactionHash) {
        console.log(`🎉 Mint transaction submitted: ${result.transactionHash}`)
    } else {
        console.error(`❌ Mint failed: ${result.error}`)
    }
}

if (import.meta.main) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Error:', error)
            process.exit(1)
        })
}
