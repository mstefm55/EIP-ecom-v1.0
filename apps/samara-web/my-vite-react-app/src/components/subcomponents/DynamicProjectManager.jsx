import { DYNAMIC_PROJECT_SEED as INITIAL_PROJECTS } from '../../data/runtimeSeeds';
import { runtimeDataStorage } from '../../lib/runtimeDataGateway';
import React, { useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { Calendar, CheckSquare, ListTodo, Plus, Sparkles, Trash2, TrendingUp, UserCheck } from 'lucide-react';

export default function DynamicProjectManager() {
  const [projects, setProjects] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_atelier_projects');
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [newProjName, setNewProjName] = useState('');
  const [newProjPattern, setNewProjPattern] = useState('Classic Linen Atelier Smock');
  const [selectedProjectId, setSelectedProjectId] = useState('proj-1');

  const saveProjects = (updated) => {
    setProjects(updated);
    try {
      runtimeDataStorage.setItem('sartorial_atelier_projects', JSON.stringify(updated));
    } catch {}
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    const newProj = {
      id: `proj-${Date.now()}`,
      name: newProjName,
      patternName: newProjPattern,
      status: 'Planning',
      progress: 0,
      startedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      tasks: [
        { id: `t-${Date.now()}-1`, text: 'Obtain precise body sizing measurements', completed: false },
        { id: `t-${Date.now()}-2`, text: 'Select appropriate linen/cotton textile yardage', completed: false },
        { id: `t-${Date.now()}-3`, text: 'Print dynamic PDF sewing layout grid blueprint', completed: false }
      ]
    };

    const updated = [newProj, ...projects];
    saveProjects(updated);
    setSelectedProjectId(newProj.id);
    setNewProjName('');
  };

  const handleDeleteProject = (id, e) => {
    e.stopPropagation();
    const updated = projects.filter(p => p.id !== id);
    saveProjects(updated);
    if (selectedProjectId === id && updated.length > 0) {
      setSelectedProjectId(updated[0].id);
    }
  };

  const toggleTask = (projId, taskId) => {
    const updated = projects.map(proj => {
      if (proj.id === projId) {
        const updatedTasks = proj.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        );
        const completedCount = updatedTasks.filter(t => t.completed).length;
        const totalCount = updatedTasks.length;
        const nextProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
          ...proj,
          tasks: updatedTasks,
          progress: nextProgress,
          status: nextProgress === 100 ? 'Completed' : nextProgress > 0 ? 'In Progress' : 'Planning'
        };
      }
      return proj;
    });
    saveProjects(updated);
  };

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dynamic-projects-subcomponent">

      {/* Sidebar: Projects List & Add Form */}
      <div className="space-y-6">
        <div className="bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-3xs">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-clay-600" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-clay-700 font-bold">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.3969605480")}</span>
          </div>
          <h3 className="text-lg font-serif font-light text-bark-950">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.2313147239")}</h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {projects.map(proj => (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all flex justify-between items-center ${
                  selectedProjectId === proj.id
                    ? 'bg-clay-50/70 border-clay-300 text-clay-900 shadow-3xs'
                    : 'bg-white border-sand-150 hover:bg-sand-50/60 text-bark-800'
                }`}
              >
                <div className="space-y-1 max-w-[80%]">
                  <h4 className="text-xs font-bold truncate">{proj.name}</h4>
                  <p className="text-[10px] text-bark-500 font-mono truncate">{proj.patternName}</p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <div className="w-16 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                      <div className="h-full bg-clay-605 rounded-full" style={{ width: `${proj.progress}%` }} />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-bark-600">{proj.progress}%</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteProject(proj.id, e)}
                  className="p-1.5 hover:bg-red-50 text-bark-400 hover:text-red-600 rounded transition-colors cursor-pointer shrink-0"
                  title={pfUiT("ui.components.subcomponents.dynamicprojectmanager.5ea5e41e44")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add Project Form */}
        <form onSubmit={handleAddProject} className="bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-3xs">
          <span className="text-[9px] font-mono uppercase text-clay-700 font-bold block">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.c23c026870")}</span>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.e1fac87668")}</label>
              <input
                type="text"
                placeholder={pfUiT("ui.components.subcomponents.dynamicprojectmanager.102432bfa2")}
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.41c5b15e49")}</label>
              <select
                value={newProjPattern}
                onChange={(e) => setNewProjPattern(e.target.value)}
                className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
              >
                <option value="The French Draped Trench">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.15b47fa81d")}</option>
                <option value="Minimalist Zero-Waste Skirt">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.bc59e87bea")}</option>
                <option value="Classic Linen Perfect Fit Smock">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.402ee1b803")}</option>
                <option value="Perfect Fit Hourglass Blazer">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.7323fe9776")}</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pfUiT("ui.components.subcomponents.dynamicprojectmanager.7b63111e1e")}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Panel: Active Project Details & Checklists */}
      <div className="lg:col-span-2">
        {activeProject ? (
          <div className="bg-white border border-sand-200 rounded-xl p-6 md:p-8 space-y-6 shadow-3xs h-full flex flex-col justify-between">
            <div className="space-y-4">
              {/* Project Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-sand-100 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-clay-500" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-bark-500">Started on {activeProject.startedDate}</span>
                  </div>
                  <h2 className="text-2xl font-serif text-bark-950 font-normal">{activeProject.name}</h2>
                  <p className="text-xs text-bark-600 font-sans">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.c2342cee7f")}<span className="font-mono bg-sand-100 px-2 py-0.5 rounded text-clay-700 font-bold text-[10px]">{activeProject.patternName}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 text-[10px] font-mono uppercase font-bold rounded-full ${
                    activeProject.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    activeProject.status === 'In Progress' ? 'bg-clay-50 text-clay-700 border border-clay-200' :
                    'bg-sand-100 text-bark-600 border border-sand-200'
                  }`}>
                    {activeProject.status}
                  </span>
                </div>
              </div>

              {/* Progress visual slider */}
              <div className="space-y-2 p-4 bg-sand-50/50 rounded-lg border border-sand-150">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-bark-800">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.cc2b5895b8")}</span>
                  <span className="font-mono font-bold text-clay-700">{activeProject.progress}% Done</span>
                </div>
                <div className="w-full h-2.5 bg-sand-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-clay-500 to-clay-650 rounded-full transition-all duration-500"
                    style={{ width: `${activeProject.progress}%` }}
                  />
                </div>
              </div>

              {/* Task Checklist */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-clay-500" />
                  <h3 className="text-sm font-bold text-bark-900">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.33e5978d93")}</h3>
                </div>

                <div className="space-y-2.5">
                  {activeProject.tasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(activeProject.id, task.id)}
                      className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all ${
                        task.completed
                          ? 'bg-stone-50/40 border-sand-150 text-bark-450 line-through'
                          : 'bg-white border-sand-200 hover:border-sand-300 text-bark-850 hover:bg-sand-50/25 shadow-4xs'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        readOnly
                        className="mt-0.5 rounded border-sand-300 text-clay-605 focus:ring-clay-500 cursor-pointer"
                      />
                      <span className="text-xs font-sans leading-relaxed">{task.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-sand-100 flex items-center gap-2 text-bark-550 text-[10.5px] font-sans italic">
              <Sparkles className="w-4 h-4 text-clay-500 shrink-0" />
              <span>{pfUiT("ui.components.subcomponents.dynamicprojectmanager.a159ae7ad6")}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-sand-200 rounded-xl p-8 text-center flex flex-col items-center justify-center h-full">
            <ListTodo className="w-12 h-12 text-bark-300 mb-3" />
            <p className="text-sm text-bark-500">{pfUiT("ui.components.subcomponents.dynamicprojectmanager.db649d6ee4")}</p>
          </div>
        )}
      </div>

    </div>
  );
}
