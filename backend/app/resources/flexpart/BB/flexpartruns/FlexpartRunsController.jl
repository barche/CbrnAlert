module FlexpartRunsController

using Genie
using Genie.Requests
using Genie.Renderer.Json: json
using SearchLight
using SearchLight.Relationships


using Flexpart
using Dates

using CbrnAlertApp: CREATED, FINISHED, ONGOING, ERRORED
using CbrnAlertApp: _area

using CbrnAlertApp.Users
using CbrnAlertApp.Users: current_user
using CbrnAlertApp.FlexpartInputs
using CbrnAlertApp.FlexpartRuns
using CbrnAlertApp.FlexpartOutputs

const FLEXPART_RUN_FAILED = Genie.Router.error(500, "Flexpart run failed", "application/json", error_info="Flexpart run failed")

function _iscompleted(fpdir)
  lines = readlines(joinpath(fpdir.path, "output.log"))
  any(occursin.("CONGRATULATIONS", lines))
end

function run()
  runtype = Genie.Router.params(:runType, "simple")

  if runtype == "simple"
    run_simple()
  else
    run_detailed()
  end
end

function run_simple()
  payload = Genie.Requests.jsonpayload()
  input_id = Genie.Router.params(:inputId)

  # COMMAND options
  sim_start = DateTime(payload["command"]["start"])
  sim_end = DateTime(payload["command"]["end"])
  time_step = payload["command"]["timeStep"]
  output_type = payload["command"]["outputType"]

  # RELEASE options
  release_start = DateTime(payload["releases"][1]["start"])
  release_end = DateTime(payload["releases"][1]["end"])
  lon, lat = values(payload["releases"][1]["location"])
  release_mass = payload["releases"][1]["mass"]
  release_height = payload["releases"][1]["height"]

  # OUTGRID options
  gridres = payload["outgrid"]["gridres"]
  area = payload["outgrid"]["area"]
  heights = payload["outgrid"]["heights"]

  fprun = FlexpartRuns.create()
  fpdir = Flexpart.FlexpartDir(fprun.path)

  fpoptions = FlexpartOption(fpdir)
  Flexpart.remove_unused_species!(fpoptions)

  # Set simulation start and end
  # TODO: update to set_cmd_dates! when new version available
  Flexpart.set_cmd_dates!(fpoptions, sim_start, sim_end)

  cmd = Dict(
    # Set simulation step
    :LOUTSTEP => time_step,
    :LOUTAVER => time_step,
    :LOUTSAMPLE => convert(Int64, time_step / 4),
    :LSYNCTIME => convert(Int64, time_step / 4),
    # Set netcdf output
    :IOUT => output_type + 8
  )
  merge!(fpoptions["COMMAND"][:COMMAND], cmd)

  # Set release options
  Flexpart.set_point_release!(fpoptions, lon, lat)
  releases_options = Dict(
    :IDATE1 => Dates.format(release_start, "yyyymmdd"),
    :ITIME1 => Dates.format(release_start, "HHMMSS"),
    :IDATE2 => Dates.format(release_end, "yyyymmdd"),
    :ITIME2 => Dates.format(release_end, "HHMMSS"),
    :Z1 => release_height,
    :Z2 => release_height,
    :PARTS => Flexpart.MAX_PARTICLES,
    :MASS => release_mass
  )
  Flexpart.merge!(fpoptions["RELEASES"][:RELEASE], releases_options)

  # Set outgrid options
  area_f = _area(area)
  outgrid = Flexpart.area2outgrid(area_f, gridres)
  Flexpart.merge!(fpoptions["OUTGRID"][:OUTGRID], outgrid)
  fpoptions["OUTGRID"][:OUTGRID][:OUTHEIGHTS] = join(heights, ", ")

  # Save the options
  Flexpart.save(fpoptions)

  # Get the input and adapt the Available file
  fpinput = findone(FlexpartInput, uuid=input_id)
  fpdir[:input] = abspath(joinpath(fpinput.path, "output"))
  avs = Available(fpdir)

  # Save the available file and the flexpart paths
  Flexpart.save(avs)
  Flexpart.save(fpdir)


  return run(fpdir, fprun) |> json
end

function run_detailed()
end

function run(fpdir::FlexpartDir, fprun::FlexpartRun)
  fpoptions = FlexpartOption(fpdir)
  Flexpart.remove_unused_species!(fpoptions)
  FlexpartRuns.change_options(fprun.name, fpoptions)
  open(joinpath(fpdir.path, "output.log"), "w") do logf
    FlexpartRuns.change_status(fprun.name, ONGOING)
    Flexpart.run(fpdir) do stream
      # log_and_broadcast(stream, request_data["ws_info"], logf)
      line = readline(stream, keep=true)
      Base.write(logf, line)
      flush(logf)
    end
  end

  if _iscompleted(fpdir)
    FlexpartRuns.change_status(fprun.name, FINISHED)
  else
    @warn "Flexpart run failed"
    FlexpartRuns.change_status(fprun.name, ERRORED)
    if ENV["GENIE_ENV"] == "prod"
      rm(fpdir.path, recursive=true)
    end
    return FLEXPART_RUN_FAILED
  end

  FlexpartRuns.assign_to_user!(current_user(), fprun)

  FlexpartOutputs.add!(fprun)

  return fprun
end

function get_runs()
  fpruns = user_related(FlexpartRun)
  filter!(FlexpartRuns.isfinished, fpruns)
  Dict.(fpruns) |> json
end

function get_run()
  id = Genie.Router.params(:runId)
  fprun = FlexpartRuns._get_run(id)
  Users.@hasaccess!(fprun)
  Dict(fprun) |> json
end

function delete_run()
  id = Genie.Router.params(:runId)
  to_delete = findone(FlexpartRun, uuid = id)
#   FlexpartRuns.delete!(to_delete)
  Dict(to_delete) |> json
end

end