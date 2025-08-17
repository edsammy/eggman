import { mintNFT, MintConfig } from './mint'

async function testMint() {
    console.log('🧪 Testing NFT mint function...\n')

    const config: MintConfig = {
        contractAddress: '0xE6DF4dD9a2ad8b0DC780f999C6D727383E180Fd3',
        privateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
        rpcUrl: process.env.RPC_URL_BASE_CHAIN || 'https://sepolia.base.org'
    }

    const recipientAddress = '0x73E05A47145c14a7b4fd075652843dCEe265428C';

    console.log('📋 Test Configuration:')
    console.log(`   Contract: ${config.contractAddress}`)
    console.log(`   RPC URL: ${config.rpcUrl}`)
    console.log(`   Recipient: ${recipientAddress}`)
    console.log('')

    if (!config.privateKey) {
        console.log('⚠️  No EVM_PRIVATE_KEY found. Set EVM_PRIVATE_KEY env var for real test.')
        console.log('❌ Cannot proceed without private key.')
        return
    }

    try {
        console.log('🚀 Starting mint test...\n')
        
        const startTime = Date.now()
        const result = await mintNFT(recipientAddress, config)
        const endTime = Date.now()

        console.log(`\n⏱️  Test completed in ${endTime - startTime}ms`)
        console.log('📊 Results:')
        console.log(`   Success: ${result.success}`)
        
        if (result.success) {
            console.log(`   Token ID: ${result.tokenId}`)
            console.log(`   Transaction: ${result.transactionHash}`)
            console.log('\n✅ Mint test PASSED!')
        } else {
            console.log(`   Error: ${result.error}`)
            console.log('\n❌ Mint test FAILED!')
        }

    } catch (error) {
        console.error('\n💥 Test crashed:')
        console.error(error)
        console.log('\n❌ Mint test CRASHED!')
    }
}

console.log('='.repeat(50))
console.log('        NFT MINT FUNCTION TEST')
console.log('='.repeat(50))

testMint()
    .then(() => {
        console.log('\n' + '='.repeat(50))
        console.log('Test completed. Set EVM_PRIVATE_KEY env var to test with real wallet:')
        process.exit(0)
    })
    .catch((error) => {
        console.error('Test runner failed:', error)
        process.exit(1)
    })
