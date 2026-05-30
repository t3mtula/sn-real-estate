# Function Index — RentalManagement
_อ่านไฟล์นี้ก่อนทุกครั้งที่ไม่รู้ว่า function อยู่ module ไหน_

| Function | Module |
|---|---|
| `compressImage()` | `01-ui-utils.js` |
| `customConfirm()` | `01-ui-utils.js` |
| `closeConfirmOverlay()` | `01-ui-utils.js` |
| `getActiveTemplate()` | `02-state.js` |
| `page` (var) | `02-state.js` |
| `currentUser` (var) | `02-state.js` |
| `settingsTab` (var) | `02-state.js` |
| `COLORS` (var) | `02-state.js` |
| `DEFAULT_CLAUSES` (var) | `02-state.js` |
| `TH_PATHS` (var) | `02-state.js` |
| `TH_CENTROIDS` (var) | `02-state.js` |
| `TH_LOC_MAP` (var) | `02-state.js` |
| `hasPermission()` | `03-auth.js` |
| `showLoginScreen()` | `03-auth.js` |
| `checkLoginPin()` | `03-auth.js` |
| `logout()` | `03-auth.js` |
| `runMigrations()` | `04-storage.js` |
| `openIDB()` | `04-storage.js` |
| `idbPut()` | `04-storage.js` |
| `idbGet()` | `04-storage.js` |
| `idbDelete()` | `04-storage.js` |
| `idbGetAll()` | `04-storage.js` |
| `save()` | `04-storage.js` |
| `saveImmediate()` | `04-storage.js` |
| `updateSaveStatus()` | `04-storage.js` |
| `exportData()` | `04-storage.js` |
| `importData()` | `04-storage.js` |
| `startAutoBackup()` | `04-storage.js` |
| `stopAutoBackup()` | `04-storage.js` |
| `restoreAutoBackup()` | `04-storage.js` |
| `deleteAutoBackup()` | `04-storage.js` |
| `downloadAutoBackup()` | `04-storage.js` |
| `DATA_VERSION` (var) | `04-storage.js` |
| `MIGRATIONS` (var) | `04-storage.js` |
| `IDB_NAME` (var) | `04-storage.js` |
| `IDB_VERSION` (var) | `04-storage.js` |
| `IDB_STORE` (var) | `04-storage.js` |
| `IDB_KEY` (var) | `04-storage.js` |
| `AUTOBACKUP_PREFIX` (var) | `04-storage.js` |
| `AUTOBACKUP_MAX` (var) | `04-storage.js` |
| `exportExcelAll()` | `05-excel.js` |
| `exportExcelContracts()` | `05-excel.js` |
| `exportExcelInvoices()` | `05-excel.js` |
| `importExcel()` | `05-excel.js` |
| `doImportExcelFull()` | `05-excel.js` |
| `doImportExcel()` | `05-excel.js` |
| `_createDP()` | `06-datepicker.js` |
| `_closeDP()` | `06-datepicker.js` |
| `_renderDP()` | `06-datepicker.js` |
| `TMONTHS` (var) | `06-datepicker.js` |
| `TDAYS` (var) | `06-datepicker.js` |
| `addActivityLog()` | `07-activity-log.js` |
| `addInvoiceAudit()` | `07-activity-log.js` |
| `viewActivityLog()` | `07-activity-log.js` |
| `parseBE()` | `08-helpers.js` |
| `fmtBE()` | `08-helpers.js` |
| `amt()` | `08-helpers.js` |
| `_extractAmt()` | `08-helpers.js` |
| `monthly()` | `08-helpers.js` |
| `isBadAddr()` | `08-helpers.js` |
| `monthlyRev()` | `08-helpers.js` |
| `status()` | `08-helpers.js` |
| `badge()` | `08-helpers.js` |
| `typeColor()` | `08-helpers.js` |
| `cat()` | `08-helpers.js` |
| `payFreq()` | `08-helpers.js` |
| `toast()` | `08-helpers.js` |
| `markModalDirty()` | `08-helpers.js` |
| `closeModal()` | `08-helpers.js` |
| `enhanceDatalistInputs()` | `08-helpers.js` |
| `kpiCard()` | `08-helpers.js` |
| `CONTRACT_RULES` (var) | `08-helpers.js` | rule registry: id, field, severity, detect, fix{type,field,validate,initial,placeholder}, apply |
| `validateContractData()` | `08-helpers.js` | iterate CONTRACT_RULES → return [{ruleId,field,severity,msg}] |
| `scanContractIssues()` | `08-helpers.js` | scan ทุก contract → คืน [{contract, issues[]}] |
| `applyDataFix()` | `08-helpers.js` | action: validate + apply rule.apply(c, values) + save() + activity log |
| `normalizeBEDate()` | `08-helpers.js` |
| `buildContractKpi()` | `13-properties.js` | render: KPI strip ใน viewContract (outstanding/onTime%/avgLate/total) |
| `buildContractTimeline()` | `13-properties.js` | render: filter chips + invoice timeline rows + slip thumb inline |
| `setVcTimelineFilter()` | `13-properties.js` | action: เปลี่ยน vcTimelineFilter + reset pagination + re-render |
| `showMoreVcTimeline()` | `13-properties.js` | action: vcTimelineShown += 12 + re-render |
| `vcTimelineFilter` (var) | `02-state.js` | UI state: 'all' \| 'unpaid' \| 'paid' |
| `vcTimelineShown` (var) | `02-state.js` | UI state: pagination counter, default 12 (Tier B) |
| `dataFixExpanded` (var) | `02-state.js` | UI state: {"cid:ruleId"→true} ของ inline fix form ที่ expand |
| `toggleDataFixExpand()` | `25-datafix.js` | action: toggle expand/collapse inline fix form |
| `submitDataFix()` | `25-datafix.js` | action: collect form value + applyDataFix + re-render |
| `renderDataFixIssue()` | `25-datafix.js` | render: 1 issue row + optional inline edit form |
| `getNotifications()` | `09-notifications.js` |
| `getNotifCounts()` | `09-notifications.js` |
| `toggleNotifPanel()` | `09-notifications.js` |
| `_closeNotifPanel()` | `09-notifications.js` |
| `renderNotifPanel()` | `09-notifications.js` |
| `updateNotifBadge()` | `09-notifications.js` |
| `buildNav()` | `10-nav.js` |
| `showPage()` | `10-nav.js` |
| `showPropTab()` | `10-nav.js` |
| `propTab` (var) | `10-nav.js` |
| `PAGES` (var) | `10-nav.js` |
| `renderSettingsPage()` | `11-settings.js` |
| `renderSettingsContractForm()` | `11-settings.js` |
| `renderSettingsCompany()` | `11-settings.js` |
| `updateInvoicePreview()` | `11-settings.js` |
| `updateInvoicePreviewDebounced()` | `11-settings.js` |
| `renderSettingsInvoice()` | `11-settings.js` |
| `saveInvoiceNote()` | `11-settings.js` |
| `renderSettingsSystem()` | `11-settings.js` |
| `renderSettingsStaff()` | `11-settings.js` |
| `render()` | `11-settings.js` |
| `buildLocData()` | `12-dashboard.js` |
| `renderDash()` | `12-dashboard.js` |
| `mapClickLoc()` | `12-dashboard.js` |
| `toggleIncomeDetail()` | `12-dashboard.js` |
| `mapSelLoc` (var) | `12-dashboard.js` |
| `MAP_LOC_COLORS` (var) | `12-dashboard.js` |
| `TH_ID_TO_LOC` (var) | `12-dashboard.js` |
| `propTabBar()` | `13-properties.js` |
| `togglePropSort()` | `13-properties.js` |
| `propInfo()` | `13-properties.js` |
| `renderProperties()` | `13-properties.js` |
| `renderPropContracts()` | `13-properties.js` |
| `togglePropExpand()` | `13-properties.js` |
| `viewContract()` | `13-properties.js` |
| `openEditContract()` | `13-properties.js` |
| `toggleFieldEdit()` | `13-properties.js` |
| `cancelFieldEdit()` | `13-properties.js` |
| `saveFieldEdit()` | `13-properties.js` |
| `vcLandlordChange()` | `13-properties.js` |
| `propFilter` (var) | `13-properties.js` |
| `propSort` (var) | `13-properties.js` |
| `propExpanded` (var) | `13-properties.js` |
| `editLandlordAddr()` | `14-contracts.js` |
| `editTenantAddr()` | `14-contracts.js` |
| `showAddrEditDialog()` | `14-contracts.js` |
| `openCancelDialog()` | `14-contracts.js` |
| `_doCancelContract()` | `14-contracts.js` |
| `restoreContract()` | `14-contracts.js` |
| `openPropertyDetail()` | `14-contracts.js` |
| `propAddImages()` | `14-contracts.js` |
| `propRemoveImage()` | `14-contracts.js` |
| `propViewImage()` | `14-contracts.js` |
| `toggleContractExpand()` | `14-contracts.js` |
| `parseAddrParts()` | `14-contracts.js` |
| `assemblePropAddr()` | `14-contracts.js` |
| `buildAddrSubFields()` | `14-contracts.js` |
| `assembleAddrFromPrefix()` | `14-contracts.js` |
| `buildPropFormHTML()` | `14-contracts.js` |
| `openAddPropertyDialog()` | `14-contracts.js` |
| `autoEnrichPropName()` | `14-contracts.js` |
| `propCheckDup()` | `14-contracts.js` |
| `editProperty()` | `14-contracts.js` |
| `deleteProperty()` | `14-contracts.js` |
| `toggleTenantExpand()` | `14-contracts.js` |
| `toggleCSort()` | `14-contracts.js` |
| `toggleSigned()` | `14-contracts.js` |
| `renderContracts()` | `14-contracts.js` |
| `toggleAllContracts()` | `14-contracts.js` |
| `handleTenantCheck()` | `14-contracts.js` |
| `handleContractCheck()` | `14-contracts.js` |
| `batchPrintContracts()` | `14-contracts.js` |
| `batchMarkSigned()` | `14-contracts.js` |
| `checkContractOverlap()` | `14-contracts.js` |
| `TH_PROVINCES` (var) | `14-contracts.js` |
| `tenantExpanded` (var) | `14-contracts.js` |
| `cSort` (var) | `14-contracts.js` |
| `cBatchSelect` (var) | `14-contracts.js` |
| `cLastChecked` (var) | `14-contracts.js` |
| `validateContractForm()` | `15-contract-form.js` |
| `liveValidateField()` | `15-contract-form.js` |
| `confirmOverlapAndSave()` | `15-contract-form.js` |
| `openAddContractDialog()` | `15-contract-form.js` |
| `editContract()` | `15-contract-form.js` |
| `renewContract()` | `15-contract-form.js` |
| `copyContract()` | `15-contract-form.js` |
| `deleteContract()` | `15-contract-form.js` |
| `contractFormHTML()` | `15-contract-form.js` |
| `cfAutoFillTenant()` | `15-contract-form.js` |
| `cfBuildTenantName()` | `15-contract-form.js` |
| `cfFormatThaiId()` | `15-contract-form.js` |
| `cfSelectBank()` | `15-contract-form.js` |
| `cfUploadTenantLogo()` | `15-contract-form.js` |
| `cfPreviewSig()` | `15-contract-form.js` |
| `cfSelectHeader()` | `15-contract-form.js` |
| `cfSelectLandlord()` | `15-contract-form.js` |
| `cfAutoFillProp()` | `15-contract-form.js` |
| `buildRateStr()` | `15-contract-form.js` |
| `resolveFormDropdowns()` | `15-contract-form.js` |
| `cfTodayBE()` | `15-contract-form.js` |
| `numToThaiBaht()` | `15-contract-form.js` |
| `fmtDeposit()` | `15-contract-form.js` |
| `cfFormatDeposit()` | `15-contract-form.js` |
| `cfCalcEnd()` | `15-contract-form.js` |
| `cfCalcEndFromDur()` | `15-contract-form.js` |
| `cfCalcDurFromEnd()` | `15-contract-form.js` |
| `cfUpdatePayment()` | `15-contract-form.js` |
| `cfGenContractNo()` | `15-contract-form.js` |
| `genNextContractNo()` | `15-contract-form.js` | pure: คำนวณเลขสัญญาถัดไปจาก max(existing) — ใช้ใน datafix autogen ด้วย |
| `regenDataFix()` | `25-datafix.js` | action: เรียก rule.fix.regen() → set input value (no re-render) |
| `renderRenew()` | `16-renewals.js` |
| `dateToThai()` | `17-contract-print.js` |
| `contractHTML()` | `17-contract-print.js` |
| `printSingleContract()` | `17-contract-print.js` |
| `previewContract()` | `17-contract-print.js` |
| `openPrintOverlay()` | `17-contract-print.js` |
| `closePrintOverlay()` | `17-contract-print.js` |
| `doPrintFromOverlay()` | `17-contract-print.js` |
| `renderPipelinePage()` | `18-pipeline.js` |
| `renderInvoicePage()` | `19-invoices.js` |
| `renderInvoiceListPage()` | `19-invoices.js` |
| `renderReceiptListPage()` | `19-invoices.js` |
| `viewReceiptDetail()` | `19-invoices.js` |
| `printReceipt()` | `19-invoices.js` |
| `receiptHTML()` | `19-invoices.js` |
| `renderInvoiceAuditPage()` | `19-invoices.js` |
| `renderInvoiceSettingsPage()` | `19-invoices.js` |
| `getDisplayStatus()` | `19-invoices.js` | computed status (overdue/partial) — render only, ไม่เก็บใน DB |
| `getDaysOverdue()` | `19-invoices.js` | จำนวนวันที่เกิน dueDate |
| `isInvoiceDue()` | `19-invoices.js` |
| `invoiceAmount()` | `19-invoices.js` |
| `generateAllInvoices()` | `19-invoices.js` |
| `generateInvoice()` | `19-invoices.js` |
| `viewInvoiceList()` | `19-invoices.js` |
| `printInvoice()` | `19-invoices.js` |
| `viewInvoiceDetail()` | `19-invoices.js` |
| `viewInvoiceAudit()` | `19-invoices.js` |
| `openReceivePaymentModal()` | `19-invoices.js` |
| `rpUploadSlip()` | `19-invoices.js` |
| `submitReceivePayment()` | `19-invoices.js` |
| `showReceiptBanner()` | `19-invoices.js` |
| `markInvoicePaid()` | `19-invoices.js` |
| `viewSlipImage()` | `19-invoices.js` |
| `renderSlipUploadPage()` | `19-invoices.js` |
| `handleSlipFiles()` | `19-invoices.js` |
| `updateSlipContractData()` | `19-invoices.js` |
| `confirmSlipPayment()` | `19-invoices.js` |
| `_doConfirmSlipPayment()` | `19-invoices.js` | action: ขั้นตอน save จริงหลัง dedup check |
| `verifySlipOk()` | `19-invoices.js` | action: POST รูป slip → SlipOK API → คืน {amount, transRef, sender, ...} |
| `autoMatchSlip()` | `19-invoices.js` | action: หา invoice ที่ amount+month ตรง → set slip.cid อัตโนมัติ |
| `showAgingReport()` | `19-invoices.js` |
| `showMonthlySummary()` | `19-invoices.js` |
| `openInvoiceForm()` | `19-invoices.js` |
| `addInvoiceItemRow()` | `19-invoices.js` |
| `calcInvTotal()` | `19-invoices.js` |
| `onInvContractChange()` | `19-invoices.js` |
| `saveInvoiceForm()` | `19-invoices.js` |
| `voidInvoice()` | `19-invoices.js` |
| `deleteInvoice()` | `19-invoices.js` |
| `openInvoiceHeaderSettings()` | `19-invoices.js` |
| `addInvoiceHeader()` | `19-invoices.js` |
| `uploadLogo()` | `19-invoices.js` |
| `uploadQR()` | `19-invoices.js` |
| `saveInvoiceHeader()` | `19-invoices.js` |
| `editInvoiceHeader()` | `19-invoices.js` |
| `updateInvoiceHeader()` | `19-invoices.js` |
| `setDefaultInvoiceHeader()` | `19-invoices.js` |
| `deleteInvoiceHeader()` | `19-invoices.js` |
| `openStaffSettings()` | `19-invoices.js` |
| `addStaffForm()` | `19-invoices.js` |
| `saveStaff()` | `19-invoices.js` |
| `editStaff()` | `19-invoices.js` |
| `deleteStaff()` | `19-invoices.js` |
| `verifyPIN()` | `19-invoices.js` |
| `checkPinInput()` | `19-invoices.js` |
| `enrichDesc()` | `19-invoices.js` |
| `_crc16CCITT()` | `19-invoices.js` |
| `buildPromptPayPayload()` | `19-invoices.js` |
| `generateQRDataUrl()` | `19-invoices.js` |
| `uploadStaffSig()` | `19-invoices.js` |
| `invoiceHTML()` | `19-invoices.js` |
| `markInvoiceSent()` | `19-invoices.js` | action: เปลี่ยน draft → sent + audit |
| `saveFollowUp()` | `19-invoices.js` | action: บันทึกวันนัดชำระ + followUpNote ลงใน inv |
| `openFollowUpModal()` | `19-invoices.js` | render: modal ตั้งวันนัดชำระ |
| `invoiceMonth` (var) | `19-invoices.js` |
| `invoiceTab` (var) | `19-invoices.js` |
| `slipSessionData` (var) | `19-invoices.js` |
| `invSort` (var) | `19-invoices.js` | UI state: sort column key |
| `invSortDir` (var) | `19-invoices.js` | UI state: 'asc' or 'desc' |
| `invSearch` (var) | `19-invoices.js` | UI state: search query |
| `invLandlordFilter` (var) | `19-invoices.js` | UI state: headerId or 'all' |
| `exportExcelReceipts()` | `19-invoices.js` | action: export ใบเสร็จเป็น Excel |
| `printPaymentReceipt()` | `19-invoices.js` | action: พิมพ์ใบเสร็จแต่ละ payment |
| `paymentReceiptHTML()` | `19-invoices.js` | render: HTML ใบเสร็จต่อ payment |
| `showAllOutstanding()` | `19-invoices.js` | render: modal ค้างชำระข้ามเดือน grouped by tenant |
| `showFollowUpDashboard()` | `19-invoices.js` | render: modal follow-up dashboard |
| `showCtxMenu()` | `20-context-menu-cf.js` |
| `hideCtxMenu()` | `20-context-menu-cf.js` |
| `showOverlapDetail()` | `20-context-menu-cf.js` |
| `debounce()` | `20-context-menu-cf.js` |
| `updateCfPreview()` | `20-context-menu-cf.js` |
| `renderContractForm()` | `20-context-menu-cf.js` |
| `renderCfEditor()` | `20-context-menu-cf.js` |
| `renderCfPreview()` | `20-context-menu-cf.js` |
| `cfSyncFromInputs()` | `20-context-menu-cf.js` |
| `cfAddClause()` | `20-context-menu-cf.js` |
| `cfRemoveClause()` | `20-context-menu-cf.js` |
| `cfMoveClause()` | `20-context-menu-cf.js` |
| `cfSaveTemplate()` | `20-context-menu-cf.js` |
| `cfResetTemplate()` | `20-context-menu-cf.js` |
| `cfSwitchTemplate()` | `20-context-menu-cf.js` |
| `cfNewVersion()` | `20-context-menu-cf.js` |
| `cfDuplicateVersion()` | `20-context-menu-cf.js` |
| `cfDeleteVersion()` | `20-context-menu-cf.js` |
| `cfSetActive()` | `20-context-menu-cf.js` |
| `cfPrintPreview()` | `20-context-menu-cf.js` |
| `renderPrintContract()` | `20-context-menu-cf.js` |
| `cfTab` (var) | `20-context-menu-cf.js` |
| `cfEditTpl` (var) | `20-context-menu-cf.js` |
| `cfPreviewUpdateTimer` (var) | `20-context-menu-cf.js` |
| `renderLandlords()` | `21-landlords.js` |
| `SEED_PROPERTIES` (var) | `21-landlords.js` |
| `SEED_PAYMENTS` (var) | `21-landlords.js` |
| `SEED_CONTRACTS` (var) | `21-landlords.js` |
| `llFilter` (var) | `21-landlords.js` |
