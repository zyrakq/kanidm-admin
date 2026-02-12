run:
  cd app/ui && bun watch >/dev/null 2>&1 &
  cd app && trail run -a 0.0.0.0:4000 --public-dir ui/dist --spa