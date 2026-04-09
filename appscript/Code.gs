/**
 * Configuration: Change these to match your Form/Sheet exactly
 */
const PARENT_FOLDER_ID = '1DpRCk9_EzcSMqdgKHWxyNHZQPApSApoi'; // The ID of the main folder where dog folders live
const DOG_NAME_COLUMN = "Foster Dog's Name:"; // The exact header text for the dog's name
const FILE_UPLOAD_COLUMN = "Please upload 5-7 usable photos and one video of the dog in their home."; // The exact header text for the file upload question

function autoOrganizeFormFiles(e) {
  try {
    const itemResponses = e.namedValues;
    const dogName = itemResponses[DOG_NAME_COLUMN][0].trim();
    const fileUrlsRaw = itemResponses[FILE_UPLOAD_COLUMN][0];

    if (!fileUrlsRaw) return; // Exit if no files were uploaded

    // 1. Get or Create the Dog's Folder
    const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const folderIterator = parentFolder.getFoldersByName(dogName);
    let targetFolder;

    if (folderIterator.hasNext()) {
      targetFolder = folderIterator.next();
    } else {
      targetFolder = parentFolder.createFolder(dogName);
    }

    // 2. Parse File IDs and Move them
    // Form file uploads are stored as a comma-separated string of URLs
    const fileIds = fileUrlsRaw.split(',').map(url => {
      const match = url.match(/[-\w]{25,}/); // Extracts the ID from the URL
      return match ? match[0] : null;
    }).filter(id => id !== null);

    fileIds.forEach(id => {
      const file = DriveApp.getFileById(id);
      file.moveTo(targetFolder);
    });

    console.log(`Successfully moved ${fileIds.length} files for ${dogName}`);

  } catch (err) {
    console.error("Error organizing files: " + err.toString());
  }
}
