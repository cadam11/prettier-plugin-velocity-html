class LoadContext {

  List<String> storageKeys = []

}

ShibbolethCommon.makeCommonData() + [
  'title': 'title',
  'titleSuffix': 'titleSuffix',
  'loadContext': new LoadContext()
]
