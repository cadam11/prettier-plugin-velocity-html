class SettingsTool {
    boolean faqEnabled = false
}


new ShibbolethCommon().makeCommonData() + [
    'settingsTool': new SettingsTool()
]