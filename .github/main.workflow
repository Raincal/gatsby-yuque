workflow "Build and Publish" {
  on = "push"
  resolves = ["Publish"]
}

action "Build" {
  uses = "actions/npm@de7a3705a9510ee12702e124482fad6af249991b"
  args = "install"
}

action "Tag" {
  uses = "actions/bin/filter@707718ee26483624de00bd146e073d915139a3d8"
  needs = ["Build"]
  args = "tag v*"
}

action "Publish" {
  uses = "actions/npm@de7a3705a9510ee12702e124482fad6af249991b"
  needs = ["Tag"]
  args = "publish --access public"
  secrets = ["NPM_AUTH_TOKEN"]
}
