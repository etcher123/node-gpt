var fs = require( 'fs' )
var MBR = require( 'mbr' )
var GPT = require( '..' )
var inspect = require( '../test/inspect' )
var utils = require( './utils' )

var argv = process.argv.slice( 2 )
var devicePath = argv.shift()

if( !devicePath ) {
  console.error(`
  Usage: node example/grow <imagefile>

  Examples:
    - Linux / Mac OS: node example/grow /dev/rdisk2
    - Windows: node example/grow \\.\PhysicalDrive0

  NOTE: This assumes a block size of 512 bytes
  WARN: The image file is modified in place by this example
`)
  process.exit(1)
}

var blockSize = 512
var fd = null

try {
  fd = fs.openSync( devicePath, 'r+' )
} catch( error ) {
  console.error( 'Couldn\'t open device for reading/writing:\n', error.message )
  process.exit( 1 )
}

var mbr = utils.readMBR( fd, blockSize )

console.log( 'Master Boot Record:', inspect( mbr ) )
console.log( '' )

var efiPart = mbr.getEFIPart()

if( efiPart == null ) {
  return console.error( 'No EFI partition found' )
}

console.log( 'EFI Partition:', inspect( efiPart ) )
console.log( '' )

var primaryGPT = utils.readPrimaryGPT( fd, blockSize, efiPart )

console.log( 'Primary GPT:', inspect( primaryGPT ) )
console.log( '' )

var backupGPT = utils.readBackupGPT( fd, primaryGPT )

console.log( 'Backup GPT:', inspect( backupGPT ) )
console.log( '' )

// Get the size of the raw image
var stats = fs.fstatSync(fd)
if( stats.isBlockDevice() ) {
  console.error( 'Block devices are not supported by this example' )
  process.exit( 1 )
}
var sizeInBytes = stats.size
if( sizeInBytes % blockSize != 0 ) {
  console.log( 'sizeInBytes is not a multiple of blockSize!' )
  process.exit( 1 )
}
var sizeInBlocks = sizeInBytes / blockSize

console.log('File size:', sizeInBytes, 'bytes,', sizeInBlocks, 'sectors')

// Move the backup GPT
primaryGPT.moveBackup( sizeInBlocks - 1 )
backupGPT.moveBackup( sizeInBlocks - 1 )

utils.writePrimaryGPT( fd, primaryGPT )
utils.writeBackupGPT( fd, backupGPT )

fs.closeSync( fd )
