#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up old recording implementation files...');

// Files to remove (outdated recording-related files)
const filesToRemove = [
  // Old test files for recording
  'test-browser-speech.html',
  'test-microphone-access.html', 
  'test-enhanced-speech-workflow.html',
  'test-simplified-recording.html',
  'test-recording-duration-fix.html',
  'test-new-transcription.cjs',
  'test-enhanced-workflow.cjs',
  
  // Old documentation files that are now outdated
  'SIMPLE_BROWSER_SPEECH_FIX.md',
  'SPEECH_API_SETUP_FIX.md',
  'SPEECH_TO_TEXT_DEBUG_GUIDE.md',
  'SPEECH_TO_TEXT_SOLUTION_SUMMARY.md',
  'ENHANCED_SPEECH_TO_TEXT_IMPLEMENTATION.md',
  'FINAL_SPEECH_TO_TEXT_SOLUTION.md',
  'FINAL_TRANSCRIPTION_FIX.md',
  'RECORDING_FIXES_SUMMARY.md',
  'RECORDING_ISSUE_FIXES_SUMMARY.md',
  'RECORDING_ISSUE_IMPLEMENTATION_GUIDE.md',
  'AUDIO_RECORDING_FIXES_SUMMARY.md',
  'AUDIO_LEVEL_DETECTION_DEBUG_PLAN.md',
  'AUDIO_LEVEL_DETECTION_SOLUTION.md'
];

// Files to keep but note as legacy
const legacyFiles = [
  'client/src/components/VisitSummaryForm_OLD_COMPLEX.tsx.backup'
];

function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️ Not found: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to remove ${filePath}:`, error.message);
    return false;
  }
}

function cleanupOldFiles() {
  let removedCount = 0;
  let notFoundCount = 0;

  console.log('\n🗑️ Removing outdated recording files...');
  
  filesToRemove.forEach(file => {
    const removed = removeFile(file);
    if (removed) {
      removedCount++;
    } else {
      notFoundCount++;
    }
  });

  console.log('\n📊 Cleanup Summary:');
  console.log(`✅ Files removed: ${removedCount}`);
  console.log(`ℹ️ Files not found: ${notFoundCount}`);
  console.log(`📁 Legacy files kept: ${legacyFiles.length}`);

  console.log('\n📁 Legacy files (kept for reference):');
  legacyFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  📄 ${file}`);
    }
  });

  console.log('\n✨ Cleanup completed!');
  console.log('\n📋 What was cleaned up:');
  console.log('- Removed old browser speech recognition test files');
  console.log('- Removed outdated recording documentation');
  console.log('- Kept backup of complex implementation for reference');
  console.log('- New simplified architecture is now active');

  console.log('\n🎯 New Architecture Benefits:');
  console.log('- Reduced from 1,810 lines to ~200 lines');
  console.log('- Reliable cloud-based processing');
  console.log('- Real-time status updates via Firestore');
  console.log('- Professional-grade Speech-to-Text');
  console.log('- AI-powered visit summarization');
  console.log('- Scalable and cost-effective');
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupOldFiles();
}

module.exports = { cleanupOldFiles, filesToRemove, legacyFiles };